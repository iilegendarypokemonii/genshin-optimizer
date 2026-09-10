use serde::Serialize;
use std::path::Path;
use tauri::Manager;
use windows::core::HSTRING;
use windows::Globalization::Language;
use windows::Graphics::Imaging::{BitmapDecoder, BitmapPixelFormat, SoftwareBitmap};
use windows::Media::Ocr::OcrEngine;
use windows::Storage::Streams::{DataWriter, InMemoryRandomAccessStream};

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct OcrLine {
    pub text: String,
    pub x: f32,
    pub y: f32,
    pub w: f32,
    pub h: f32,
}

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct OcrOutput {
    pub lines: Vec<OcrLine>,
    pub image_w: u32,
    pub image_h: u32,
}

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct OcrError {
    /// One of: OcrUnavailable | BadPath | ReadError | DecodeError | OcrFailed
    pub kind: String,
    pub message: String,
}

impl OcrError {
    fn new(kind: &str, message: impl Into<String>) -> Self {
        Self {
            kind: kind.into(),
            message: message.into(),
        }
    }
}

/// True when `candidate` is `base` itself or lies inside it.
/// Both paths must already be canonicalized by the caller.
fn is_under(base: &Path, candidate: &Path) -> bool {
    candidate.starts_with(base)
}

/// WinRT activation requires an initialized apartment on the calling thread.
/// Tauri command threads are not guaranteed to have one; initializing twice is harmless.
fn ensure_winrt_init() {
    use windows::Win32::System::WinRT::{RoInitialize, RO_INIT_MULTITHREADED};
    unsafe {
        let _ = RoInitialize(RO_INIT_MULTITHREADED);
    }
}

fn create_engine() -> Result<OcrEngine, OcrError> {
    if let Ok(engine) = OcrEngine::TryCreateFromUserProfileLanguages() {
        return Ok(engine);
    }
    let lang = Language::CreateLanguage(&HSTRING::from("en")).map_err(|e| {
        OcrError::new("OcrUnavailable", format!("Cannot create language: {e}"))
    })?;
    OcrEngine::TryCreateFromLanguage(&lang).map_err(|e| {
        OcrError::new(
            "OcrUnavailable",
            format!("No OCR language pack available (install the English language pack in Windows settings): {e}"),
        )
    })
}

fn ocr_image_bytes(bytes: &[u8]) -> Result<OcrOutput, OcrError> {
    let decode = |e: windows::core::Error| OcrError::new("DecodeError", e.to_string());
    let failed = |e: windows::core::Error| OcrError::new("OcrFailed", e.to_string());

    let stream = InMemoryRandomAccessStream::new().map_err(decode)?;
    let writer = DataWriter::CreateDataWriter(&stream).map_err(decode)?;
    writer.WriteBytes(bytes).map_err(decode)?;
    writer.StoreAsync().map_err(decode)?.get().map_err(decode)?;
    writer.FlushAsync().map_err(decode)?.get().map_err(decode)?;
    writer.DetachStream().map_err(decode)?;
    stream.Seek(0).map_err(decode)?;

    let decoder = BitmapDecoder::CreateAsync(&stream)
        .map_err(decode)?
        .get()
        .map_err(|e| OcrError::new("DecodeError", format!("Not a decodable image: {e}")))?;
    let bitmap = decoder
        .GetSoftwareBitmapAsync()
        .map_err(decode)?
        .get()
        .map_err(decode)?;
    // The OCR engine rejects some decoder-native pixel formats; always convert.
    let converted = SoftwareBitmap::Convert(&bitmap, BitmapPixelFormat::Bgra8).map_err(decode)?;

    let image_w = converted.PixelWidth().map_err(decode)? as u32;
    let image_h = converted.PixelHeight().map_err(decode)? as u32;
    let max = OcrEngine::MaxImageDimension().map_err(failed)?;
    if image_w > max || image_h > max {
        return Err(OcrError::new(
            "DecodeError",
            format!("Image {image_w}x{image_h} exceeds the OCR engine limit of {max}px; crop or downscale the screenshot"),
        ));
    }

    let engine = create_engine()?;
    let result = engine
        .RecognizeAsync(&converted)
        .map_err(failed)?
        .get()
        .map_err(failed)?;

    let mut lines = Vec::new();
    for line in result.Lines().map_err(failed)? {
        let text = line.Text().map_err(failed)?.to_string();
        let mut min_x = f32::MAX;
        let mut min_y = f32::MAX;
        let mut max_x = f32::MIN;
        let mut max_y = f32::MIN;
        let mut has_rect = false;
        for word in line.Words().map_err(failed)? {
            let r = word.BoundingRect().map_err(failed)?;
            min_x = min_x.min(r.X);
            min_y = min_y.min(r.Y);
            max_x = max_x.max(r.X + r.Width);
            max_y = max_y.max(r.Y + r.Height);
            has_rect = true;
        }
        if !has_rect {
            continue;
        }
        lines.push(OcrLine {
            text,
            x: min_x,
            y: min_y,
            w: max_x - min_x,
            h: max_y - min_y,
        });
    }
    Ok(OcrOutput {
        lines,
        image_w,
        image_h,
    })
}

/// Run Windows OCR over an image stored under the app's local data directory.
/// `rel_path` is relative to AppLocalData; the frontend writes the file there first.
#[tauri::command] // sync on purpose: runs on Tauri's command thread pool, safe to block on .get()
pub fn ocr_screenshot(app: tauri::AppHandle, rel_path: String) -> Result<OcrOutput, OcrError> {
    let base = app
        .path()
        .app_local_data_dir()
        .map_err(|e| OcrError::new("BadPath", format!("No app data dir: {e}")))?;
    let base = base
        .canonicalize()
        .map_err(|e| OcrError::new("BadPath", format!("App data dir missing: {e}")))?;
    let candidate = base
        .join(&rel_path)
        .canonicalize()
        .map_err(|e| OcrError::new("BadPath", format!("Screenshot not found: {e}")))?;
    if !is_under(&base, &candidate) {
        return Err(OcrError::new(
            "BadPath",
            "Path escapes the app data directory",
        ));
    }
    let bytes = std::fs::read(&candidate)
        .map_err(|e| OcrError::new("ReadError", format!("Cannot read screenshot: {e}")))?;
    ensure_winrt_init();
    ocr_image_bytes(&bytes)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn is_under_accepts_children_and_self() {
        let base = Path::new(r"C:\Users\me\AppData\Local\app");
        assert!(is_under(base, base));
        assert!(is_under(
            base,
            Path::new(r"C:\Users\me\AppData\Local\app\teamdps\screenshots\a.png")
        ));
    }

    #[test]
    fn is_under_rejects_outside_paths() {
        let base = Path::new(r"C:\Users\me\AppData\Local\app");
        assert!(!is_under(base, Path::new(r"C:\Users\me\AppData\Local")));
        assert!(!is_under(base, Path::new(r"C:\Windows\System32")));
        // Sibling directory sharing the prefix string must not match.
        assert!(!is_under(
            base,
            Path::new(r"C:\Users\me\AppData\Local\app2\x.png")
        ));
    }

    #[test]
    fn ocr_rejects_garbage_bytes() {
        ensure_winrt_init();
        let err = ocr_image_bytes(b"definitely not a png").unwrap_err();
        assert_eq!(err.kind, "DecodeError");
    }
}
