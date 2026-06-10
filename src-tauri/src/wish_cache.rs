use regex::bytes::Regex;
use serde::Serialize;
use std::fs;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

/// Well-known install locations probed when the user has not configured a path.
const GAME_DIR_CANDIDATES: &[&str] = &[
    r"A:\Games\Genshin Impact game",
    r"C:\Program Files\Genshin Impact\Genshin Impact game",
    r"C:\Program Files\HoYoPlay\games\Genshin Impact game",
];

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WishUrlResult {
    pub url: String,
    pub cache_mtime_ms: u64,
    pub game_dir: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct WishCacheError {
    /// One of: GameDirNotFound | NoCacheFile | NoUrlInCache | ReadError
    pub kind: String,
    pub message: String,
}

impl WishCacheError {
    fn new(kind: &str, message: impl Into<String>) -> Self {
        Self {
            kind: kind.into(),
            message: message.into(),
        }
    }
}

fn resolve_game_dir(configured: Option<String>) -> Result<PathBuf, WishCacheError> {
    if let Some(dir) = configured {
        let path = PathBuf::from(&dir);
        if path.join("GenshinImpact_Data").is_dir() {
            return Ok(path);
        }
        return Err(WishCacheError::new(
            "GameDirNotFound",
            format!("Configured game folder has no GenshinImpact_Data: {dir}"),
        ));
    }
    for candidate in GAME_DIR_CANDIDATES {
        let path = PathBuf::from(candidate);
        if path.join("GenshinImpact_Data").is_dir() {
            return Ok(path);
        }
    }
    Err(WishCacheError::new(
        "GameDirNotFound",
        "Genshin install not found in known locations; set the game folder in the wish tracker settings",
    ))
}

/// The game writes one cache dir per webview version; the newest data_2 holds
/// the URLs from the most recent session.
fn newest_cache_file(game_dir: &Path) -> Result<PathBuf, WishCacheError> {
    let web_caches = game_dir.join("GenshinImpact_Data").join("webCaches");
    let entries = fs::read_dir(&web_caches).map_err(|e| {
        WishCacheError::new(
            "NoCacheFile",
            format!("Cannot read {}: {e}", web_caches.display()),
        )
    })?;
    let mut newest: Option<(std::time::SystemTime, PathBuf)> = None;
    for entry in entries.flatten() {
        let data2 = entry.path().join("Cache").join("Cache_Data").join("data_2");
        if let Ok(meta) = fs::metadata(&data2) {
            let mtime = meta.modified().unwrap_or(UNIX_EPOCH);
            if newest.as_ref().map_or(true, |(t, _)| mtime > *t) {
                newest = Some((mtime, data2));
            }
        }
    }
    newest.map(|(_, p)| p).ok_or_else(|| {
        WishCacheError::new(
            "NoCacheFile",
            "No webCaches data_2 file found; start the game once first",
        )
    })
}

/// The LAST getGachaLog URL in the cache belongs to the account that most
/// recently opened the in-game wish history screen.
fn extract_last_url(blob: &[u8]) -> Option<String> {
    let url_re = Regex::new(r"https://[\x20-\x7e]+?getGachaLog[\x20-\x7e]+").unwrap();
    let raw = url_re.find_iter(blob).last()?;
    let url = String::from_utf8_lossy(raw.as_bytes()).into_owned();
    // cache entries carry trailing printable junk; the URL ends at game_biz=<token>
    let trim_re = regex::Regex::new(r"^.*?game_biz=\w*").unwrap();
    Some(
        trim_re
            .find(&url)
            .map(|m| m.as_str().to_owned())
            .unwrap_or(url),
    )
}

#[tauri::command]
pub async fn get_wish_url(game_dir: Option<String>) -> Result<WishUrlResult, WishCacheError> {
    let dir = resolve_game_dir(game_dir)?;
    let cache_file = newest_cache_file(&dir)?;
    // plain read works even while the game holds the file open (read sharing)
    let blob = fs::read(&cache_file).map_err(|e| {
        WishCacheError::new(
            "ReadError",
            format!("Cannot read {}: {e}", cache_file.display()),
        )
    })?;
    let mtime_ms = fs::metadata(&cache_file)
        .ok()
        .and_then(|m| m.modified().ok())
        .and_then(|t| t.duration_since(UNIX_EPOCH).ok())
        .map(|d| d.as_millis() as u64)
        .unwrap_or(0);
    let url = extract_last_url(&blob).ok_or_else(|| {
        WishCacheError::new(
            "NoUrlInCache",
            "No wish-history URL in the game cache; open the wish history screen in-game, then retry",
        )
    })?;
    Ok(WishUrlResult {
        url,
        cache_mtime_ms: mtime_ms,
        game_dir: dir.to_string_lossy().into_owned(),
    })
}

#[cfg(test)]
mod tests {
    use super::extract_last_url;

    #[test]
    fn extracts_last_url_and_trims_at_game_biz() {
        let blob = b"\x00junk https://old.example.com/event/gacha_info/api/getGachaLog?authkey=AAA&game_biz=hk4e_global trailing\x01\
            more\x00https://public-operation-hk4e-sg.hoyoverse.com/gacha_info/api/getGachaLog?win_mode=fullscreen&authkey=BBB%2F%2B&lang=en&game_biz=hk4e_global\x1f1/0/junk";
        let url = extract_last_url(blob).unwrap();
        assert!(url.starts_with("https://public-operation-hk4e-sg.hoyoverse.com"));
        assert!(url.contains("authkey=BBB%2F%2B"));
        assert!(url.ends_with("game_biz=hk4e_global"));
    }

    #[test]
    fn returns_none_when_absent() {
        assert_eq!(extract_last_url(b"https://example.com/other nothing here"), None);
    }
}
