mod irminsul;
mod ocr;
mod verify;
mod wish_cache;

use tauri::webview::PageLoadEvent;
use tauri::Manager;

const HU_TAO_CALCULATOR_LABEL: &str = "tool-hu-tao-gacha-calculator";
const HU_TAO_CALCULATOR_HOST: &str = "hutaobot.moe";
const ACCEPT_HU_TAO_COOKIES: &str = r#"
  document.cookie = 'CookieConsent=true; Path=/; Max-Age=31536000; SameSite=Lax';
  document.querySelector('#rcc-confirm-button')?.click();
"#;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    if let Some(result) = irminsul_core::run_helper_if_requested() {
        std::process::exit(if result.is_ok() { 0 } else { 1 });
    }
    let verify_config = verify::read_config().expect("Invalid verification configuration");
    let mut context = tauri::generate_context!();
    if let Some(config) = &verify_config {
        context.config_mut().identifier =
            format!("{}.verify-{}", verify::VERIFY_IDENTIFIER, config.profile);
        let window = context
            .config_mut()
            .app
            .windows
            .iter_mut()
            .find(|window| window.label == verify::VERIFY_WINDOW_LABEL)
            .expect("Configured verification window is missing");
        window.title = format!(
            "{} [verify: {}]",
            verify::VERIFY_WINDOW_TITLE,
            config.profile
        );
    }
    tauri::Builder::default()
        .manage(verify::VerifyState(std::sync::Mutex::new(verify_config)))
        .manage(irminsul::Irminsul(std::sync::Mutex::new(
            irminsul_core::CaptureController::new().expect("Could not load bundled capture data"),
        )))
        .on_page_load(|webview, payload| {
            if webview.label() == HU_TAO_CALCULATOR_LABEL
                && payload.event() == PageLoadEvent::Finished
                && payload.url().host_str() == Some(HU_TAO_CALCULATOR_HOST)
            {
                let _ = webview.eval(ACCEPT_HU_TAO_COOKIES);
            }
        })
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            wish_cache::get_wish_url,
            ocr::ocr_screenshot,
            irminsul::irminsul_status,
            irminsul::irminsul_start,
            irminsul::irminsul_stop,
            irminsul::irminsul_snapshot,
            verify::verify_info,
            verify::irminsul_inject_fixture
        ])
        .build(context)
        .expect("error while building tauri application")
        .run(|app, event| {
            if matches!(event, tauri::RunEvent::Exit) {
                if let Some(state) = app.try_state::<irminsul::Irminsul>() {
                    if let Ok(mut controller) = state.0.lock() {
                        let _ = controller.stop_and_wait();
                    }
                }
            }
        });
}
