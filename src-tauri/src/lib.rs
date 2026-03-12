mod browser;
mod config;
mod deps;
mod updater;
mod worker;

use std::sync::Mutex;
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Manager,
};
use worker::WorkerState;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_fs::init())
        .manage(Mutex::new(WorkerState::default()))
        .setup(|app| {
            // Create system tray
            let show_i = MenuItem::with_id(app, "show", "Show", true, None::<&str>)?;
            let quit_i = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&show_i, &quit_i])?;

            let tray_icon = app.default_window_icon().cloned()
                .expect("no default window icon configured");

            let _tray = TrayIconBuilder::new()
                .icon(tray_icon)
                .icon_as_template(true)
                .tooltip("NarraFork Launcher")
                .menu(&menu)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.set_skip_taskbar(false);
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "quit" => {
                        // Stop worker before quitting
                        if let Some(state) = app.try_state::<Mutex<WorkerState>>() {
                            if let Ok(mut state) = state.lock() {
                                if let Some(ref mut process) = state.process {
                                    let _ = process.kill();
                                }
                            }
                        }
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let tauri::tray::TrayIconEvent::Click { button: tauri::tray::MouseButton::Left, .. } = event {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.set_skip_taskbar(false);
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            // Auto-start worker if configured
            let config = config::LauncherConfig::load();
            if config.worker.auto_start {
                if let Some(state) = app.try_state::<Mutex<WorkerState>>() {
                    let _ = worker::start_worker(
                        app.handle().clone(),
                        state,
                        config.worker.path,
                        Some(config.worker.port),
                        Some(config.worker.host),
                        None, // theme: auto on startup
                    );
                }
            }

            Ok(())
        })
        .on_window_event(|window, event| {
            if let tauri::WindowEvent::CloseRequested { api, .. } = event {
                eprintln!("[NarraFork] CloseRequested for window: '{}'", window.label());
                if window.label() == "main" {
                    let config = config::LauncherConfig::load();
                    eprintln!("[NarraFork] Main window close_action: '{}'", config.launch.close_action);
                    if config.launch.close_action == "minimize" {
                        api.prevent_close();
                        // Hide from taskbar + hide window = true minimize-to-tray
                        let _ = window.set_skip_taskbar(true);
                        let _ = window.hide();
                        eprintln!("[NarraFork] Main window hidden to tray");
                    } else {
                        // Quit: stop worker then exit
                        eprintln!("[NarraFork] Main window closing — stopping worker and exiting");
                        if let Some(state) = window.app_handle().try_state::<Mutex<WorkerState>>() {
                            if let Ok(mut state) = state.lock() {
                                if let Some(ref mut process) = state.process {
                                    let _ = process.kill();
                                }
                            }
                        }
                        window.app_handle().exit(0);
                    }
                } else {
                    eprintln!("[NarraFork] Non-main window '{}' closing normally", window.label());
                }
            }
        })
        .invoke_handler(tauri::generate_handler![
            // Config
            config::get_config,
            config::save_config,
            config::get_config_path,
            // Worker
            worker::get_worker_status,
            worker::start_worker,
            worker::stop_worker,
            worker::restart_worker,
            worker::find_worker_path,
            // Dependencies
            deps::check_dependencies,
            deps::get_git_user_config,
            deps::set_git_user_config,
            deps::open_install_url,
            // Updates
            updater::check_for_updates,
            updater::download_update,
            updater::download_worker_to_dir,
            updater::get_current_version,
            updater::get_pending_update,
            // Browser & Service Workers
            browser::open_in_browser,
            browser::close_inline_browser,
            browser::clear_browsing_data,
            browser::get_app_url,
            browser::get_service_workers,
            browser::unregister_service_workers,
            browser::update_service_workers,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
