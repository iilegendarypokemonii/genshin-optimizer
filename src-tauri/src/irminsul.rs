use irminsul_core::{CaptureController, CaptureMode, CaptureState, Snapshot};
use std::sync::Mutex;
use tauri::{State, WebviewWindow};

pub struct Irminsul(pub Mutex<CaptureController>);

fn check_window(window: &WebviewWindow) -> Result<(), String> {
    if window.label() != "main" {
        return Err("Capture is only available in the main application window.".into());
    }
    Ok(())
}

#[tauri::command]
pub fn irminsul_status(
    window: WebviewWindow,
    state: State<'_, Irminsul>,
) -> Result<CaptureState, String> {
    check_window(&window)?;
    state
        .0
        .lock()
        .map_err(|e| e.to_string())?
        .state()
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub fn irminsul_start(
    window: WebviewWindow,
    state: State<'_, Irminsul>,
    mode: Option<CaptureMode>,
) -> Result<(), String> {
    check_window(&window)?;
    state
        .0
        .lock()
        .map_err(|e| e.to_string())?
        .start_with_mode(mode.unwrap_or_default())
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn irminsul_stop(window: WebviewWindow, app: tauri::AppHandle) -> Result<(), String> {
    use tauri::Manager;
    check_window(&window)?;
    tauri::async_runtime::spawn_blocking(move || {
        let state = app.state::<Irminsul>();
        let result = state
            .0
            .lock()
            .map_err(|e| e.to_string())?
            .stop_and_wait()
            .map_err(|e| e.to_string());
        result
    })
    .await
    .map_err(|e| e.to_string())?
}

#[tauri::command]
pub fn irminsul_snapshot(
    window: WebviewWindow,
    state: State<'_, Irminsul>,
    uid: String,
    capture_id: String,
) -> Result<Snapshot, String> {
    check_window(&window)?;
    state
        .0
        .lock()
        .map_err(|e| e.to_string())?
        .snapshot(&uid, &capture_id)
        .map_err(|e| e.to_string())
}

#[cfg(test)]
mod tests {
    use std::collections::BTreeSet;

    /// Quoted keys of `export const <name> = [ ... ] as const` in a consts file.
    fn const_keys(src: &str, name: &str) -> Vec<String> {
        let start = src
            .find(&format!("export const {name} = ["))
            .unwrap_or_else(|| panic!("{name} not found"));
        let body = &src[start..start + src[start..].find("] as const").unwrap()];
        body.split('\'')
            .skip(1)
            .step_by(2)
            .map(String::from)
            .collect()
    }

    fn missing(known: Vec<String>, bundled: &BTreeSet<String>, custom: &[&str]) -> Vec<String> {
        known
            .into_iter()
            .filter(|key| !bundled.contains(key) && !custom.contains(&key.as_str()))
            .collect()
    }

    /// Fails when the optimizer has new game data that capture would reject as
    /// "Unknown weapon ID". Fix: refresh the data in irminsul-core (see its
    /// README, "Updating for a new game version") and bump its rev here.
    #[test]
    fn capture_data_covers_optimizer_weapons_and_characters() {
        let bundled = irminsul_core::bundled_good_keys().unwrap();
        let weapons = include_str!("../../libs/gi/consts/src/weapon.ts");
        let characters = include_str!("../../libs/gi/consts/src/character.ts");
        let weapon_keys = ["Sword", "Claymore", "Polearm", "Bow", "Catalyst"]
            .iter()
            .flat_map(|kind| const_keys(weapons, &format!("allWeapon{kind}Keys")))
            .collect::<Vec<_>>();
        assert!(weapon_keys.len() > 200 && weapon_keys.contains(&"MistsplitterReforged".into()));
        // Custom entries the optimizer defines itself; the game has no such items.
        let missing_weapons = missing(weapon_keys, &bundled.weapons, &["QuantumCatalyst"]);
        let missing_characters = missing(
            const_keys(characters, "nonTravelerCharacterKeys"),
            &bundled.characters,
            &["Somnia"],
        );
        assert!(
            missing_weapons.is_empty() && missing_characters.is_empty(),
            "Irminsul capture data is older than the optimizer data. Missing weapons: \
             {missing_weapons:?}; characters: {missing_characters:?}"
        );
        // Without these, imports fail on an elementless "Traveler" (7.1).
        let data = irminsul_core::game_data().unwrap();
        assert!(data.get_tps_avatar_id_male().is_ok() && data.get_tps_avatar_id_female().is_ok());
    }
}
