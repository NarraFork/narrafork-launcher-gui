//! NarraFork Launcher GUI - Browser Launch & Service Worker Management

use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager};
use crate::config::LauncherConfig;

#[tauri::command]
pub fn open_in_browser(_app: AppHandle, port: Option<u16>, host: Option<String>) -> Result<String, String> {
    let config = LauncherConfig::load();
    let port = port.unwrap_or(config.worker.port);
    let host = host.unwrap_or(config.worker.host);
    let url = format!("http://{}:{}", host, port);

    eprintln!("[NarraFork] open_in_browser called, mode={}, url={}", config.launch.mode, url);

    if config.launch.mode == "external" {
        eprintln!("[NarraFork] Opening in external browser: {}", url);
        open::that(&url).map_err(|e| format!("Failed to open browser: {}", e))?;
    }

    // Return the URL — frontend handles inline window creation via JS API
    Ok(url)
}

/// Explicitly close the inline browser window
#[tauri::command]
pub fn close_inline_browser(app: AppHandle) -> Result<(), String> {
    if let Some(window) = app.get_webview_window("narrafork-app") {
        window.destroy().map_err(|e| format!("Failed to close window: {}", e))?;
    }
    Ok(())
}

/// Clear all browsing data (cookies, localStorage, cache, etc.) for the WebView
#[tauri::command]
pub fn clear_browsing_data(app: AppHandle) -> Result<(), String> {
    eprintln!("[NarraFork] Clearing all browsing data...");
    // Close inline browser first if open
    if let Some(window) = app.get_webview_window("narrafork-app") {
        let _ = window.destroy();
    }
    // Clear via main webview — all windows share the same WebView2 profile
    if let Some(window) = app.get_webview_window("main") {
        window.clear_all_browsing_data()
            .map_err(|e| format!("Failed to clear browsing data: {}", e))?;
        eprintln!("[NarraFork] Browsing data cleared");
    }
    Ok(())
}

#[tauri::command]
pub fn get_app_url(port: Option<u16>, host: Option<String>) -> String {
    let config = LauncherConfig::load();
    let port = port.unwrap_or(config.worker.port);
    let host = host.unwrap_or(config.worker.host);

    format!("http://{}:{}", host, port)
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServiceWorkerInfo {
    pub scope: String,
    pub script_url: String,
    pub state: String,
}

/// Execute JavaScript in the main webview to query service workers registered
/// on the worker's origin via a hidden iframe approach.
/// Since SW are origin-scoped and the launcher runs on a different origin,
/// we invoke a small HTTP endpoint on the worker instead.
#[tauri::command]
pub async fn get_service_workers(port: Option<u16>, host: Option<String>) -> Result<Vec<ServiceWorkerInfo>, String> {
    let config = LauncherConfig::load();
    let port = port.unwrap_or(config.worker.port);
    let host = host.unwrap_or(config.worker.host);
    let url = format!("http://{}:{}/api/sw/list", host, port);

    let client = reqwest::Client::builder()
        .user_agent("NarraFork-Launcher")
        .build()
        .map_err(|e| e.to_string())?;

    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Failed to query service workers: {}", e))?;

    if !response.status().is_success() {
        return Ok(Vec::new());
    }

    response
        .json::<Vec<ServiceWorkerInfo>>()
        .await
        .map_err(|e| format!("Failed to parse SW info: {}", e))
}

#[tauri::command]
pub async fn unregister_service_workers(port: Option<u16>, host: Option<String>) -> Result<bool, String> {
    let config = LauncherConfig::load();
    let port = port.unwrap_or(config.worker.port);
    let host = host.unwrap_or(config.worker.host);
    let url = format!("http://{}:{}/api/sw/unregister", host, port);

    let client = reqwest::Client::builder()
        .user_agent("NarraFork-Launcher")
        .build()
        .map_err(|e| e.to_string())?;

    let response = client
        .post(&url)
        .send()
        .await
        .map_err(|e| format!("Failed to unregister service workers: {}", e))?;

    Ok(response.status().is_success())
}

#[tauri::command]
pub async fn update_service_workers(port: Option<u16>, host: Option<String>) -> Result<bool, String> {
    let config = LauncherConfig::load();
    let port = port.unwrap_or(config.worker.port);
    let host = host.unwrap_or(config.worker.host);
    let url = format!("http://{}:{}/api/sw/update", host, port);

    let client = reqwest::Client::builder()
        .user_agent("NarraFork-Launcher")
        .build()
        .map_err(|e| e.to_string())?;

    let response = client
        .post(&url)
        .send()
        .await
        .map_err(|e| format!("Failed to update service workers: {}", e))?;

    Ok(response.status().is_success())
}
