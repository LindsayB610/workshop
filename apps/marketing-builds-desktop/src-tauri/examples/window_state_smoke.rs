//! Hidden native integration check. Never opens Workshop, a GUI browser, or a
//! visible window. Uses an incognito webview and a separate test app identifier.
//! Run separate processes with: window_state_smoke save|close|restore|maximized|corrupt|numeric-corrupt|offscreen|unwritable /tmp/STATE_DIR
#[path = "../src/window_state.rs"]
#[allow(dead_code)]
mod window_state;

use std::{error::Error, fs, path::Path};
use tauri::{Manager, PhysicalPosition, PhysicalSize, WebviewWindow};

type CheckResult = Result<(), Box<dyn Error>>;

fn bounds(window: &WebviewWindow) -> Result<serde_json::Value, Box<dyn Error>> {
    let size = window.inner_size()?;
    let position = window.outer_position()?;
    Ok(
        serde_json::json!({"width": size.width, "height": size.height, "x": position.x, "y": position.y}),
    )
}

fn check(mode: &str, root: &Path, window: &WebviewWindow) -> CheckResult {
    window_state::restore_geometry(window)?;
    if window.is_visible()? || window.is_focused()? {
        return Err("Smoke window must remain hidden and unfocused".into());
    }
    if mode == "save" || mode == "close" {
        let monitor = window.primary_monitor()?.ok_or("No monitor available")?;
        let area = monitor.work_area();
        let outer = window.outer_size()?;
        let inner = window.inner_size()?;
        let chrome_width = outer.width.saturating_sub(inner.width);
        let chrome_height = outer.height.saturating_sub(inner.height);
        let desired_width = if mode == "close" { 1230.0 } else { 1100.0 };
        let width = ((desired_width * monitor.scale_factor()) as u32)
            .min(area.size.width.saturating_sub(chrome_width));
        let height = ((720.0 * monitor.scale_factor()) as u32)
            .min(area.size.height.saturating_sub(chrome_height));
        window.set_size(PhysicalSize::new(width, height))?;
        let offset = (40.0 * monitor.scale_factor()) as u32;
        window.set_position(PhysicalPosition::new(
            area.position.x
                + offset.min(area.size.width.saturating_sub(width + chrome_width)) as i32,
            area.position.y
                + offset.min(area.size.height.saturating_sub(height + chrome_height)) as i32,
        ))?;
        window_state::settle_native_changes(window)?;
        fs::write(
            root.join("expected.json"),
            serde_json::to_vec(&bounds(window)?)?,
        )?;
    } else if mode == "restore" || mode == "maximized" {
        if mode == "maximized" {
            if !window.is_maximized()? {
                return Err("Saved maximization did not restore".into());
            }
            window.unmaximize()?;
            window_state::settle_native_changes(window)?;
            if window.is_visible()? || window.is_focused()? {
                return Err("Zoom must not reveal the smoke window".into());
            }
        }
        let expected: serde_json::Value =
            serde_json::from_slice(&fs::read(root.join("expected.json"))?)?;
        let actual = bounds(window)?;
        if actual != expected {
            return Err(format!(
                "Saved geometry did not restore: expected {expected}, actual {actual}"
            )
            .into());
        }
    } else {
        let monitor = window
            .current_monitor()?
            .or(window.primary_monitor()?)
            .ok_or("No monitor available")?;
        let area = monitor.work_area();
        let position = window.outer_position()?;
        let size = window.outer_size()?;
        if size.width == 0
            || size.height == 0
            || position.x < area.position.x
            || position.y < area.position.y
            || i64::from(position.x) + i64::from(size.width)
                > i64::from(area.position.x) + i64::from(area.size.width)
            || i64::from(position.y) + i64::from(size.height)
                > i64::from(area.position.y) + i64::from(area.size.height)
        {
            return Err(format!("Recovery did not fit the display: {:?}", bounds(window)?).into());
        }
    }
    println!("{mode}: native geometry check passed: {}", bounds(window)?);
    Ok(())
}

#[cfg(target_os = "macos")]
fn main() -> CheckResult {
    let args: Vec<_> = std::env::args().collect();
    if args.len() != 3
        || ![
            "save",
            "close",
            "restore",
            "maximized",
            "corrupt",
            "numeric-corrupt",
            "offscreen",
            "unwritable",
        ]
        .contains(&args[1].as_str())
    {
        return Err(
            "Usage: window_state_smoke save|close|restore|maximized|corrupt|numeric-corrupt|offscreen|unwritable /absolute/temp/directory"
                .into(),
        );
    }
    let mode = args[1].clone();
    let root = std::path::PathBuf::from(&args[2]);
    if !root.is_absolute() {
        return Err("State directory must be absolute".into());
    }
    fs::create_dir_all(&root)?;
    let state_path = root.join("window-state.json");
    if mode == "maximized" {
        let mut saved: serde_json::Value = serde_json::from_slice(&fs::read(&state_path)?)?;
        saved["main"]["maximized"] = serde_json::json!(true);
        saved["main"]["prev_x"] = saved["main"]["x"].clone();
        saved["main"]["prev_y"] = saved["main"]["y"].clone();
        fs::write(&state_path, serde_json::to_vec(&saved)?)?;
    }
    if mode == "corrupt" {
        fs::write(&state_path, b"{broken-json")?;
    }
    if mode == "numeric-corrupt" {
        fs::write(&state_path, br#"{"main":{"width":1280,"height":840,"x":2147483647,"y":50,"prev_x":0,"prev_y":50,"maximized":false,"visible":false,"decorated":true,"fullscreen":false}}"#)?;
    }
    if mode == "unwritable" {
        if state_path.is_file() {
            fs::remove_file(&state_path)?;
        }
        fs::create_dir(&state_path)?;
    }
    if mode == "offscreen" {
        fs::write(&state_path, br#"{"main":{"width":10000,"height":8000,"x":30000,"y":30000,"prev_x":30000,"prev_y":30000,"maximized":false,"visible":false,"decorated":true,"fullscreen":false}}"#)?;
    }
    let mut context = tauri::generate_context!();
    context.config_mut().identifier = "com.lindsaybrunner.workshop.window-state-smoke".into();
    context.config_mut().app.windows.clear();
    let mut app = tauri::Builder::default()
        .enable_macos_default_menu(false)
        .plugin(
            window_state::builder()
                .with_filename(state_path.to_string_lossy())
                .build(),
        )
        .setup(|app| {
            tauri::WebviewWindowBuilder::new(
                app,
                "main",
                tauri::WebviewUrl::External("about:blank".parse()?),
            )
            .visible(false)
            .focused(false)
            .skip_taskbar(true)
            .incognito(true)
            .inner_size(1280.0, 840.0)
            .min_inner_size(1024.0, 700.0)
            .build()?;
            Ok(())
        })
        .build(context)?;
    // Set before the event loop starts, so the test cannot activate the Dock or
    // take focus. Windows stay hidden throughout all scenarios.
    app.set_activation_policy(tauri::ActivationPolicy::Prohibited);
    app.set_dock_visibility(false);
    let code = app.run_return(move |app, event| {
        if let tauri::RunEvent::Ready = event {
            let handle = app.clone();
            let mode = mode.clone();
            let root = root.clone();
            tauri::async_runtime::spawn_blocking(move || {
                let result = handle
                    .get_webview_window("main")
                    .ok_or_else(|| "Missing smoke window".into())
                    .and_then(|window| check(&mode, &root, &window));
                match result {
                    Ok(()) if mode == "close" => {
                        if let Some(window) = handle.get_webview_window("main") {
                            if let Err(error) = window.close() {
                                eprintln!("Native close failed: {error}");
                                handle.exit(1);
                            }
                        }
                    }
                    Ok(()) => handle.exit(0),
                    Err(error) => {
                        eprintln!("Native smoke failed: {error}");
                        handle.exit(1);
                    }
                }
            });
        }
    });
    // The production plugin saves in RunEvent::Exit, not in this harness.
    std::process::exit(code);
}

#[cfg(not(target_os = "macos"))]
fn main() {
    eprintln!("This hidden native smoke check requires macOS.");
    std::process::exit(1);
}
