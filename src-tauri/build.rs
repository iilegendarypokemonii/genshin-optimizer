fn main() {
    // Declaring the app commands makes Tauri check them against the capabilities,
    // so only the local app window can call them (not external tool websites).
    tauri_build::try_build(tauri_build::Attributes::new().app_manifest(
        tauri_build::AppManifest::new().commands(&[
            "get_wish_url",
            "ocr_screenshot",
            "irminsul_status",
            "irminsul_start",
            "irminsul_stop",
            "irminsul_snapshot",
            "verify_info",
            "irminsul_inject_fixture",
        ]),
    ))
    .expect("failed to run tauri-build");
}
