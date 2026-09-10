mod ocr;
mod wish_cache;

use tauri::webview::PageLoadEvent;

const HU_TAO_CALCULATOR_LABEL: &str = "tool-hu-tao-gacha-calculator";
const HU_TAO_CALCULATOR_HOST: &str = "hutaobot.moe";
const ACCEPT_HU_TAO_COOKIES: &str = r#"
  document.cookie = 'CookieConsent=true; Path=/; Max-Age=31536000; SameSite=Lax';
  document.querySelector('#rcc-confirm-button')?.click();
"#;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
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
        .invoke_handler(tauri::generate_handler![wish_cache::get_wish_url, ocr::ocr_screenshot])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
