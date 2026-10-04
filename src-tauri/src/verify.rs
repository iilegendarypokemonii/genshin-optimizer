use serde::Serialize;
use std::sync::Mutex;
use tauri::{Manager, State, WebviewWindow};

pub const VERIFY_PROTOCOL: u32 = 1;
pub const VERIFY_IDENTIFIER: &str = "com.iilegendarypokemonii.genshinoptimizerlocal";
pub const VERIFY_WINDOW_LABEL: &str = "main";
pub const VERIFY_WINDOW_TITLE: &str = "Genshin Optimizer Local";
pub const VERIFY_MARKER: &str = "GO_VERIFY_PROTOCOL_V1";

// Keep this standalone ASCII marker in every native executable. The verification
// harness scans an unlaunched binary before it is allowed to touch any profile.
#[used]
static GO_VERIFY_PROTOCOL_V1_MARKER: &[u8] = b"GO_VERIFY_PROTOCOL_V1\0";

#[derive(Clone, Debug)]
pub struct VerifyConfig {
    pub profile: String,
}

#[derive(Clone, Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VerifyInfo {
    pub protocol: u32,
    pub profile: String,
    pub identifier: String,
    pub data_dir: String,
    pub version: String,
    pub marker: &'static str,
    pub live_capture_disabled: bool,
}

pub struct VerifyState(pub Mutex<Option<VerifyConfig>>);

pub fn validate_profile(profile: &str) -> Result<(), String> {
    if profile.is_empty()
        || profile.len() > 32
        || !profile.bytes().enumerate().all(|(index, byte)| {
            (byte.is_ascii_lowercase() || byte.is_ascii_digit()) || (index > 0 && byte == b'-')
        })
    {
        return Err("GO_VERIFY_PROFILE must match ^[a-z0-9][a-z0-9-]{0,31}$.".into());
    }
    Ok(())
}

pub fn read_config() -> Result<Option<VerifyConfig>, String> {
    let profile = match std::env::var("GO_VERIFY_PROFILE") {
        Ok(profile) => profile,
        Err(std::env::VarError::NotPresent) => return Ok(None),
        Err(_) => return Err("GO_VERIFY_PROFILE must contain valid Unicode.".into()),
    };
    validate_profile(&profile)?;
    Ok(Some(VerifyConfig { profile }))
}

fn check_window(
    window: &WebviewWindow,
    app: &tauri::AppHandle,
    state: &State<'_, VerifyState>,
) -> Result<VerifyConfig, String> {
    let config = state.0.lock().map_err(|error| error.to_string())?.clone();
    check_gate(config, window.label(), &app.config().identifier)
}

fn check_gate(
    config: Option<VerifyConfig>,
    label: &str,
    identifier: &str,
) -> Result<VerifyConfig, String> {
    let config = config.ok_or_else(|| "Verification profile is not enabled.".to_string())?;
    if label != VERIFY_WINDOW_LABEL {
        return Err("Verification is only available in the main application window.".into());
    }
    let expected_identifier = format!("{VERIFY_IDENTIFIER}.verify-{}", config.profile);
    if identifier != expected_identifier {
        return Err("Verification application identifier is not isolated.".into());
    }
    Ok(config)
}

#[tauri::command]
pub fn verify_info(
    window: WebviewWindow,
    app: tauri::AppHandle,
    state: State<'_, VerifyState>,
) -> Result<VerifyInfo, String> {
    let config = check_window(&window, &app, &state)?;
    let data_dir = app
        .path()
        .app_local_data_dir()
        .map_err(|error| error.to_string())?;
    Ok(VerifyInfo {
        protocol: VERIFY_PROTOCOL,
        profile: config.profile,
        identifier: app.config().identifier.clone(),
        data_dir: data_dir.to_string_lossy().into_owned(),
        version: env!("CARGO_PKG_VERSION").into(),
        marker: VERIFY_MARKER,
        live_capture_disabled: true,
    })
}

#[tauri::command]
pub fn irminsul_inject_fixture(
    window: WebviewWindow,
    app: tauri::AppHandle,
    _verify: State<'_, VerifyState>,
    state: State<'_, crate::irminsul::Irminsul>,
    fixture: String,
) -> Result<irminsul_core::SnapshotSummary, String> {
    // Keep the profile/window gate before parsing or mutating native state.
    check_window(&window, &app, &_verify)?;
    state
        .0
        .lock()
        .map_err(|error| error.to_string())?
        .inject_fixture(&fixture)
        .map_err(|error| error.to_string())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn command_gate_requires_isolated_profile_and_main_window() {
        let config = VerifyConfig {
            profile: "test".into(),
        };
        let isolated = format!("{VERIFY_IDENTIFIER}.verify-test");
        assert!(check_gate(None, "main", &isolated).is_err());
        assert!(check_gate(Some(config.clone()), "tool-window", &isolated).is_err());
        assert!(check_gate(Some(config.clone()), "main", VERIFY_IDENTIFIER).is_err());
        assert!(check_gate(Some(config), "main", &isolated).is_ok());
    }

    #[test]
    fn marker_and_contract_constants_are_stable() {
        assert_eq!(VERIFY_PROTOCOL, 1);
        assert_eq!(
            VERIFY_IDENTIFIER,
            "com.iilegendarypokemonii.genshinoptimizerlocal"
        );
        assert!(std::str::from_utf8(GO_VERIFY_PROTOCOL_V1_MARKER)
            .unwrap()
            .starts_with("GO_VERIFY_PROTOCOL_V1"));
    }

    #[test]
    fn profile_validation_is_strict() {
        for value in ["clean-01", "a0"] {
            assert!(validate_profile(value).is_ok());
        }
        for value in [
            "",
            "../escape",
            "bad/name",
            "-leading",
            "A.b_c",
            "a_b",
            "a.b",
        ] {
            assert!(validate_profile(value).is_err());
        }
    }

    #[test]
    fn shared_irminsul_fixture_declares_expected_contract() {
        let fixture: serde_json::Value = serde_json::from_str(include_str!(
            "../../tools/verify/fixtures/irminsul/patch-7-1.json"
        ))
        .unwrap();
        assert_eq!(fixture["fixture"]["uid"], "900000001");
        assert_eq!(fixture["expect"]["absentCharacterKeys"][0], "Traveler");
        assert_eq!(
            fixture["expect"]["artifactKeys"][0]["setKey"],
            "DeepwoodMemories"
        );
        assert_eq!(
            fixture["expect"]["equippedLocations"][0]["location"],
            "Vodyanitsa"
        );
    }

    #[test]
    fn shared_irminsul_fixture_produces_expected_native_export() {
        let wrapper: serde_json::Value = serde_json::from_str(include_str!(
            "../../tools/verify/fixtures/irminsul/patch-7-1.json"
        ))
        .unwrap();
        let mut controller = irminsul_core::CaptureController::new().unwrap();
        let summary = controller
            .inject_fixture(&wrapper["fixture"].to_string())
            .unwrap();
        assert_eq!(summary.uid, "900000001");
        assert_eq!(summary.counts.characters, 2);
        assert_eq!(summary.counts.artifacts, 1);
        assert_eq!(summary.counts.weapons, 1);
        assert_eq!(summary.counts.materials, 1);
        let snapshot = controller
            .snapshot(&summary.uid, &summary.capture_id)
            .unwrap();
        let characters = snapshot.good["characters"].as_array().unwrap();
        let character_keys: Vec<_> = characters
            .iter()
            .filter_map(|value| value["key"].as_str())
            .collect();
        assert_eq!(character_keys, ["TravelerCryo", "Vodyanitsa"]);
        assert!(!character_keys.contains(&"Traveler"));
        assert_eq!(snapshot.good["weapons"][0]["key"], "WintersHeavyHeart");
        assert_eq!(snapshot.good["materials"]["Apple"], 3);
        assert_eq!(snapshot.good["artifacts"][0]["setKey"], "DeepwoodMemories");
        for (key, expected) in wrapper["expect"]["artifactKeys"][0].as_object().unwrap() {
            assert_eq!(&snapshot.good["artifacts"][0][key], expected);
        }
        assert_eq!(snapshot.good["artifacts"][0]["location"], "Vodyanitsa");
    }
}
