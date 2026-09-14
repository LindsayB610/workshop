//! Native window placement policy. Coordinates are physical pixels; minimum
//! content sizes are logical pixels, matching tauri.conf.json.
use tauri::{LogicalSize, Manager, PhysicalPosition, PhysicalSize, Runtime, WebviewWindow};
use tauri_plugin_window_state::{AppHandleExt, StateFlags, WindowExt};

const MIN_WIDTH: f64 = 1024.0;
const MIN_HEIGHT: f64 = 700.0;

pub(super) fn builder() -> tauri_plugin_window_state::Builder {
    tauri_plugin_window_state::Builder::default()
        .with_state_flags(state_flags())
        .with_filter(|label| label == "main")
        // Restore in setup, before showing, so monitor recovery precedes maximization.
        .skip_initial_state("main")
}

// A malformed numeric state can deserialize successfully but overflow the
// plugin's i32 monitor-intersection arithmetic. Treat it like corrupt JSON.
fn safe_saved_geometry(value: &serde_json::Value) -> bool {
    let coordinate = |key: &str| {
        value["main"][key]
            .as_i64()
            .and_then(|n| i32::try_from(n).ok())
    };
    let dimension = |key: &str| {
        value["main"][key]
            .as_u64()
            .and_then(|n| i32::try_from(n).ok())
            .filter(|n| *n > 0)
    };
    match (
        coordinate("x"),
        coordinate("y"),
        coordinate("prev_x"),
        coordinate("prev_y"),
        dimension("width"),
        dimension("height"),
    ) {
        (Some(x), Some(y), Some(_), Some(_), Some(width), Some(height)) => {
            x.checked_add(width).is_some() && y.checked_add(height).is_some()
        }
        _ => false,
    }
}

fn can_restore_saved_geometry<R: Runtime>(window: &WebviewWindow<R>) -> bool {
    let Ok(directory) = window.app_handle().path().app_config_dir() else {
        return false;
    };
    let file = directory.join(window.app_handle().filename());
    match std::fs::read(file) {
        Ok(bytes) => serde_json::from_slice(&bytes).is_ok_and(|value| safe_saved_geometry(&value)),
        Err(error) => error.kind() == std::io::ErrorKind::NotFound,
    }
}

// Worker-thread only. Tauri first queues the command, then macOS queues the
// AppKit mutation separately. Drain both queues before inspecting native bounds.
pub(super) fn settle_native_changes<R: Runtime>(window: &WebviewWindow<R>) -> tauri::Result<()> {
    let _ = window.inner_size()?;
    #[cfg(target_os = "macos")]
    dispatch2::DispatchQueue::main().exec_sync(|| {});
    Ok(())
}

pub(super) fn restore_geometry<R: Runtime>(window: &WebviewWindow<R>) -> tauri::Result<()> {
    let can_restore = can_restore_saved_geometry(window);
    if can_restore {
        if let Err(error) = window.restore_state(StateFlags::SIZE | StateFlags::POSITION) {
            eprintln!("Workshop could not restore window bounds: {error}");
        }
    }
    settle_native_changes(window)?;
    if let Err(error) = fit_native_window(window) {
        eprintln!("Workshop could not fit window to the current display: {error}");
        let _ = window.center();
    }
    settle_native_changes(window)?;
    if can_restore {
        if let Err(error) = window.restore_state(StateFlags::MAXIMIZED) {
            eprintln!("Workshop could not restore window maximization: {error}");
        }
    }
    settle_native_changes(window)
}

pub(super) fn restore_and_show<R: Runtime>(window: &WebviewWindow<R>) -> tauri::Result<()> {
    restore_geometry(window)?;
    // Never restore hidden/minimized state, and never leave startup hidden on a
    // recoverable state-file or monitor error.
    window.show()?;
    window.set_focus()
}

fn fit_native_window<R: Runtime>(window: &WebviewWindow<R>) -> tauri::Result<()> {
    let position = window.outer_position()?;
    let outer_size = window.outer_size()?;
    let inner_size = window.inner_size()?;
    let chrome = (
        outer_size.width.saturating_sub(inner_size.width) as f64,
        outer_size.height.saturating_sub(inner_size.height) as f64,
    );
    let mut monitors = window.available_monitors()?;
    // Deterministic fallback for a disconnected display: prefer the primary.
    if let Some(primary) = window.primary_monitor()? {
        monitors.sort_by_key(|monitor| monitor.position() != primary.position());
    }
    let displays: Vec<_> = monitors
        .iter()
        .map(|monitor| {
            let area = monitor.work_area();
            Display {
                work_area: Rect {
                    x: area.position.x as f64,
                    y: area.position.y as f64,
                    width: area.size.width as f64,
                    height: area.size.height as f64,
                },
                scale: monitor.scale_factor(),
            }
        })
        .collect();
    let outer = Rect {
        x: position.x as f64,
        y: position.y as f64,
        width: outer_size.width as f64,
        height: outer_size.height as f64,
    };
    if let Some(placement) = fit_to_displays(outer, chrome, &displays) {
        // The configured minimum must not force the window beyond a small screen.
        window.set_min_size(Some(LogicalSize::new(
            placement.min_width,
            placement.min_height,
        )))?;
        let fitted = placement.outer;
        if fitted.width != outer.width || fitted.height != outer.height {
            window.set_size(PhysicalSize::new(
                (fitted.width - chrome.0).round() as u32,
                (fitted.height - chrome.1).round() as u32,
            ))?;
        }
        if fitted.x != outer.x || fitted.y != outer.y {
            window.set_position(PhysicalPosition::new(
                fitted.x.round() as i32,
                fitted.y.round() as i32,
            ))?;
        }
    }
    Ok(())
}

pub(super) fn state_flags() -> StateFlags {
    StateFlags::SIZE | StateFlags::POSITION | StateFlags::MAXIMIZED
}

#[derive(Clone, Copy, Debug, PartialEq)]
struct Rect {
    x: f64,
    y: f64,
    width: f64,
    height: f64,
}

#[derive(Clone, Copy, Debug)]
struct Display {
    work_area: Rect,
    scale: f64,
}

#[derive(Clone, Copy, Debug, PartialEq)]
struct Placement {
    outer: Rect,
    min_width: f64,
    min_height: f64,
}

fn fit_to_displays(outer: Rect, chrome: (f64, f64), displays: &[Display]) -> Option<Placement> {
    let overlap = |area: Rect| {
        let width = (outer.x + outer.width).min(area.x + area.width) - outer.x.max(area.x);
        let height = (outer.y + outer.height).min(area.y + area.height) - outer.y.max(area.y);
        width.max(0.0) * height.max(0.0)
    };
    let display = displays
        .iter()
        .filter(|display| {
            let area = display.work_area;
            area.x.is_finite()
                && area.y.is_finite()
                && area.width.is_finite()
                && area.height.is_finite()
                && area.width > chrome.0
                && area.height > chrome.1
                && display.scale.is_finite()
                && display.scale > 0.0
        })
        .reduce(|best, next| {
            if overlap(next.work_area) > overlap(best.work_area) {
                next
            } else {
                best
            }
        })?;
    let area = display.work_area;
    let min_width = MIN_WIDTH.min((area.width - chrome.0) / display.scale);
    let min_height = MIN_HEIGHT.min((area.height - chrome.1) / display.scale);
    // Bound the recomputed minimum too: fractional display scales can otherwise
    // round a fitted minimum just above the maximum and make clamp panic.
    let width = outer.width.clamp(
        (min_width * display.scale + chrome.0).min(area.width),
        area.width,
    );
    let height = outer.height.clamp(
        (min_height * display.scale + chrome.1).min(area.height),
        area.height,
    );
    Some(Placement {
        outer: Rect {
            x: outer.x.clamp(area.x, area.x + area.width - width),
            y: outer.y.clamp(area.y, area.y + area.height - height),
            width,
            height,
        },
        min_width,
        min_height,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn display(x: f64, y: f64, width: f64, height: f64, scale: f64) -> Display {
        Display {
            work_area: Rect {
                x,
                y,
                width,
                height,
            },
            scale,
        }
    }

    fn rect(x: f64, y: f64, width: f64, height: f64) -> Rect {
        Rect {
            x,
            y,
            width,
            height,
        }
    }

    #[test]
    fn rejects_numeric_corruption_before_native_restoration() {
        let mut value = serde_json::json!({"main": {
            "width": 1280, "height": 840, "x": -1920, "y": 50,
            "prev_x": -1920, "prev_y": 50
        }});
        assert!(safe_saved_geometry(&value));
        value["main"]["x"] = serde_json::json!(i32::MAX);
        assert!(!safe_saved_geometry(&value));
        value["main"]["x"] = serde_json::json!(0);
        value["main"]["width"] = serde_json::json!(u32::MAX);
        assert!(!safe_saved_geometry(&value));
        value["main"]["width"] = serde_json::json!(1280);
        value["main"]["prev_y"] = serde_json::json!(i64::MIN);
        assert!(!safe_saved_geometry(&value));
    }

    #[test]
    fn persists_only_geometry_and_maximization() {
        let flags = state_flags();
        assert!(flags.contains(StateFlags::SIZE | StateFlags::POSITION | StateFlags::MAXIMIZED));
        assert!(!flags
            .intersects(StateFlags::VISIBLE | StateFlags::FULLSCREEN | StateFlags::DECORATIONS));
    }

    #[test]
    fn preserves_an_accessible_window_exactly() {
        let original = rect(180.0, 90.0, 1280.0, 872.0);
        let fitted = fit_to_displays(
            original,
            (0.0, 32.0),
            &[display(0.0, 25.0, 1920.0, 1010.0, 1.0)],
        )
        .unwrap();
        assert_eq!(fitted.outer, original);
    }

    #[test]
    fn disconnected_display_recovers_onto_primary_work_area() {
        let fitted = fit_to_displays(
            rect(2400.0, 120.0, 1600.0, 1032.0),
            (0.0, 32.0),
            &[display(0.0, 25.0, 1440.0, 815.0, 1.0)],
        )
        .unwrap();
        assert_eq!(fitted.outer, rect(0.0, 25.0, 1440.0, 815.0));
    }

    #[test]
    fn brings_title_bar_below_menu_bar_and_window_above_dock() {
        let fitted = fit_to_displays(
            rect(100.0, -800.0, 1280.0, 1600.0),
            (0.0, 32.0),
            &[display(0.0, 25.0, 1440.0, 815.0, 1.0)],
        )
        .unwrap();
        assert_eq!(fitted.outer, rect(100.0, 25.0, 1280.0, 815.0));
    }

    #[test]
    fn allows_displays_left_of_and_above_primary() {
        let screens = [
            display(0.0, 25.0, 1920.0, 1010.0, 1.0),
            display(-1920.0, -1080.0, 1920.0, 1050.0, 1.0),
        ];
        let original = rect(-1700.0, -1000.0, 1280.0, 872.0);
        assert_eq!(
            fit_to_displays(original, (0.0, 32.0), &screens)
                .unwrap()
                .outer,
            original
        );
    }

    #[test]
    fn uses_the_screen_containing_most_of_the_window() {
        let screens = [
            display(0.0, 25.0, 1440.0, 815.0, 1.0),
            display(1440.0, 25.0, 1920.0, 1010.0, 1.0),
        ];
        let fitted =
            fit_to_displays(rect(1400.0, 80.0, 1280.0, 872.0), (0.0, 32.0), &screens).unwrap();
        assert_eq!(fitted.outer, rect(1440.0, 80.0, 1280.0, 872.0));
    }

    #[test]
    fn respects_retina_scale_and_includes_title_bar_in_fit() {
        let fitted = fit_to_displays(
            rect(3000.0, 0.0, 2560.0, 1744.0),
            (0.0, 64.0),
            &[display(0.0, 50.0, 2560.0, 1500.0, 2.0)],
        )
        .unwrap();
        assert_eq!(fitted.outer, rect(0.0, 50.0, 2560.0, 1500.0));
        assert_eq!((fitted.min_width, fitted.min_height), (1024.0, 700.0));
    }

    #[test]
    fn reduces_minimum_size_for_a_small_usable_screen() {
        let fitted = fit_to_displays(
            rect(0.0, 0.0, 1280.0, 872.0),
            (0.0, 32.0),
            &[display(0.0, 25.0, 800.0, 550.0, 1.0)],
        )
        .unwrap();
        assert_eq!(fitted.outer, rect(0.0, 25.0, 800.0, 550.0));
        assert_eq!((fitted.min_width, fitted.min_height), (800.0, 518.0));
    }

    #[test]
    fn invalid_saved_size_recovers_to_a_usable_minimum() {
        let fitted = fit_to_displays(
            rect(100.0, 100.0, 0.0, 0.0),
            (0.0, 32.0),
            &[display(0.0, 25.0, 1920.0, 1010.0, 1.0)],
        )
        .unwrap();
        assert_eq!(fitted.outer, rect(100.0, 100.0, 1024.0, 732.0));
    }

    #[test]
    fn fractional_scales_and_small_work_areas_never_exceed_available_bounds() {
        for scale in [1.0, 1.25, 1.5, 1.75, 2.0, 2.5, 3.0] {
            for width in [640.0, 801.0, 1024.0, 1440.0, 2560.0] {
                for height in [401.0, 601.0, 815.0, 1080.0] {
                    let area = display(-1000.0, 25.0, width, height, scale);
                    for (x, y) in [(-5000.0, -1000.0), (-500.0, 100.0), (5000.0, 5000.0)] {
                        let result = fit_to_displays(
                            rect(x, y, 3840.0, 2160.0),
                            (2.0, 32.0 * scale),
                            &[area],
                        )
                        .unwrap();
                        let fitted = result.outer;
                        assert!(fitted.x >= area.work_area.x);
                        assert!(fitted.y >= area.work_area.y);
                        assert!(fitted.x + fitted.width <= area.work_area.x + width + 0.00001);
                        assert!(fitted.y + fitted.height <= area.work_area.y + height + 0.00001);
                        assert!(result.min_width > 0.0 && result.min_height > 0.0);
                    }
                }
            }
        }
    }

    #[test]
    fn fitting_an_already_recovered_window_is_stable() {
        let screens = [display(0.0, 25.0, 1440.0, 815.0, 1.0)];
        let first =
            fit_to_displays(rect(5000.0, -400.0, 2560.0, 1744.0), (0.0, 32.0), &screens).unwrap();
        assert_eq!(
            fit_to_displays(first.outer, (0.0, 32.0), &screens).unwrap(),
            first
        );
    }

    #[test]
    fn unavailable_monitor_metadata_leaves_os_placement_alone() {
        assert!(fit_to_displays(rect(0.0, 0.0, 1280.0, 872.0), (0.0, 32.0), &[]).is_none());
        assert!(fit_to_displays(
            rect(0.0, 0.0, 1280.0, 872.0),
            (0.0, 32.0),
            &[display(0.0, 0.0, 0.0, 0.0, 1.0)]
        )
        .is_none());
    }
}
