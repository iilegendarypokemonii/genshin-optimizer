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
