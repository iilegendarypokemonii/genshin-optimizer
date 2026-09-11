use serde::Serialize;
use std::path::Path;
use tauri::Manager;
use windows::core::HSTRING;
use windows::Globalization::Language;
use windows::Graphics::Imaging::{
    BitmapAlphaMode, BitmapBounds, BitmapDecoder, BitmapInterpolationMode, BitmapPixelFormat,
    BitmapTransform, ColorManagementMode, ExifOrientationMode,
};
use windows::Media::Ocr::OcrEngine;
use windows::Storage::Streams::{DataWriter, InMemoryRandomAccessStream};

#[derive(Serialize, Debug, Clone)]
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
    let lang = Language::CreateLanguage(&HSTRING::from("en"))
        .map_err(|e| OcrError::new("OcrUnavailable", format!("Cannot create language: {e}")))?;
    OcrEngine::TryCreateFromLanguage(&lang).map_err(|e| {
        OcrError::new(
            "OcrUnavailable",
            format!("No OCR language pack available (install the English language pack in Windows settings): {e}"),
        )
    })
}

/// Largest scale <= `want` that keeps both dimensions within the engine limit.
fn scale_for(w: u32, h: u32, max_dim: u32, want: f64) -> f64 {
    let cap = (max_dim as f64 / w as f64).min(max_dim as f64 / h as f64);
    want.min(cap).max(0.0)
}

/// Intersection-over-union of two boxes, for deduping lines across passes.
fn iou(a: &OcrLine, b: &OcrLine) -> f32 {
    let ix = (a.x + a.w).min(b.x + b.w) - a.x.max(b.x);
    let iy = (a.y + a.h).min(b.y + b.h) - a.y.max(b.y);
    if ix <= 0.0 || iy <= 0.0 {
        return 0.0;
    }
    let inter = ix * iy;
    let union = a.w * a.h + b.w * b.h - inter;
    if union <= 0.0 {
        0.0
    } else {
        inter / union
    }
}

/// A region of the source image to recognize, at a given upscale factor.
/// `bounds` is in original-image pixels; None = the whole image.
struct Pass {
    bounds: Option<(u32, u32, u32, u32)>,
    scale: f64,
}

/// Recognize one pass; returned line boxes are mapped back to original-image space.
fn recognize_pass(
    engine: &OcrEngine,
    decoder: &BitmapDecoder,
    full_w: u32,
    full_h: u32,
    max_dim: u32,
    pass: &Pass,
) -> Result<Vec<OcrLine>, windows::core::Error> {
    let (bx, by, bw, bh) = pass
        .bounds
        .unwrap_or((0, 0, full_w, full_h));
    let scale = scale_for(bw, bh, max_dim, pass.scale);
    if scale < 0.99 {
        // even 1x does not fit the engine limit; skip this pass
        return Ok(Vec::new());
    }

    let transform = BitmapTransform::new()?;
    transform.SetScaledWidth((full_w as f64 * scale).round() as u32)?;
    transform.SetScaledHeight((full_h as f64 * scale).round() as u32)?;
    transform.SetInterpolationMode(BitmapInterpolationMode::Fant)?;
    // Bounds are applied AFTER scaling, so express them in scaled coordinates.
    let sb = BitmapBounds {
        X: (bx as f64 * scale) as u32,
        Y: (by as f64 * scale) as u32,
        Width: ((bw as f64 * scale) as u32).min((full_w as f64 * scale) as u32),
        Height: ((bh as f64 * scale) as u32).min((full_h as f64 * scale) as u32),
    };
    transform.SetBounds(sb)?;

    let bitmap = decoder
        .GetSoftwareBitmapTransformedAsync(
            BitmapPixelFormat::Bgra8,
            BitmapAlphaMode::Premultiplied,
            &transform,
            ExifOrientationMode::IgnoreExifOrientation,
            ColorManagementMode::DoNotColorManage,
        )?
        .get()?;

    let result = engine.RecognizeAsync(&bitmap)?.get()?;
    let mut lines = Vec::new();
    for line in result.Lines()? {
        let text = line.Text()?.to_string();
        let mut min_x = f32::MAX;
        let mut min_y = f32::MAX;
        let mut max_x = f32::MIN;
        let mut max_y = f32::MIN;
        let mut has_rect = false;
        for word in line.Words()? {
            let r = word.BoundingRect()?;
            min_x = min_x.min(r.X);
            min_y = min_y.min(r.Y);
            max_x = max_x.max(r.X + r.Width);
            max_y = max_y.max(r.Y + r.Height);
            has_rect = true;
        }
        if !has_rect {
            continue;
        }
        // map from scaled-crop space back to original-image space
        let s = scale as f32;
        lines.push(OcrLine {
            text,
            x: (sb.X as f32 + min_x) / s,
            y: (sb.Y as f32 + min_y) / s,
            w: (max_x - min_x) / s,
            h: (max_y - min_y) / s,
        });
    }
    Ok(lines)
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
    let full_w = decoder.OrientedPixelWidth().map_err(decode)?;
    let full_h = decoder.OrientedPixelHeight().map_err(decode)?;
    if full_w == 0 || full_h == 0 {
        return Err(OcrError::new("DecodeError", "Empty image"));
    }

    let max_dim = OcrEngine::MaxImageDimension().map_err(failed)?;
    if scale_for(full_w, full_h, max_dim, 1.0) < 0.99 {
        return Err(OcrError::new(
            "DecodeError",
            format!("Image {full_w}x{full_h} exceeds the OCR engine limit of {max_dim}px; crop or downscale the screenshot"),
        ));
    }

    let engine = create_engine()?;

    // High-resolution crops of the HUD (left) and the character rail + UID
    // (right) come first so their lines win dedupe; a full-image pass catches
    // the rest. Small game text resolves far better at 2-3x scale.
    let passes = [
        Pass {
            bounds: Some((0, 0, (full_w as f64 * 0.45) as u32, full_h)),
            scale: 2.5,
        },
        Pass {
            bounds: Some((
                (full_w as f64 * 0.70) as u32,
                0,
                (full_w as f64 * 0.30) as u32,
                full_h,
            )),
            scale: 2.5,
        },
        Pass {
            bounds: None,
            scale: 2.0,
        },
    ];

    let mut merged: Vec<OcrLine> = Vec::new();
    let mut pass_errors: Vec<String> = Vec::new();
    for pass in &passes {
        match recognize_pass(&engine, &decoder, full_w, full_h, max_dim, pass) {
            Ok(lines) => {
                for line in lines {
                    if !merged.iter().any(|kept| iou(kept, &line) > 0.5) {
                        merged.push(line);
                    }
                }
            }
            Err(e) => pass_errors.push(e.to_string()),
        }
    }
    if merged.is_empty() && !pass_errors.is_empty() {
        return Err(OcrError::new("OcrFailed", pass_errors.join("; ")));
    }

    Ok(OcrOutput {
        lines: merged,
        image_w: full_w,
        image_h: full_h,
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
    fn scale_for_respects_engine_limit() {
        assert!((scale_for(2540, 1430, 10000, 2.5) - 2.5).abs() < 1e-9);
        assert!((scale_for(2540, 1430, 2600, 2.5) - (2600.0 / 2540.0)).abs() < 1e-9);
        assert!(scale_for(12000, 100, 10000, 2.0) < 0.99);
    }

    #[test]
    fn iou_dedupes_overlapping_boxes() {
        let a = OcrLine {
            text: "a".into(),
            x: 0.0,
            y: 0.0,
            w: 100.0,
            h: 20.0,
        };
        let same = OcrLine {
            text: "a2".into(),
            x: 2.0,
            y: 1.0,
            w: 100.0,
            h: 20.0,
        };
        let other = OcrLine {
            text: "b".into(),
            x: 300.0,
            y: 0.0,
            w: 100.0,
            h: 20.0,
        };
        assert!(iou(&a, &same) > 0.5);
        assert!(iou(&a, &other) < 0.01);
    }

    /// Manual helper: OCR_DUMP="p1;p2" cargo test dump_ocr_from_env -- --ignored --nocapture
    #[test]
    #[ignore]
    fn dump_ocr_from_env() {
        ensure_winrt_init();
        let paths = std::env::var("OCR_DUMP").expect("set OCR_DUMP to ;-separated image paths");
        for p in paths.split(';') {
            let bytes = std::fs::read(p).expect("readable image path");
            let out = ocr_image_bytes(&bytes).expect("ocr");
            println!("=== {p} ({}x{})", out.image_w, out.image_h);
            for l in out.lines {
                println!("[{:.0},{:.0},{:.0},{:.0}] {}", l.x, l.y, l.w, l.h, l.text);
            }
        }
    }

    #[test]
    fn ocr_rejects_garbage_bytes() {
        ensure_winrt_init();
        let err = ocr_image_bytes(b"definitely not a png").unwrap_err();
        assert_eq!(err.kind, "DecodeError");
    }
}
