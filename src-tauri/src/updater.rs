//! NarraFork Launcher GUI - Update Management

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

const GITHUB_RELEASES_URL: &str = "https://api.github.com/repos/nicepkg/narrafork/releases/latest";
const CURRENT_VERSION: &str = env!("CARGO_PKG_VERSION");

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateInfo {
    pub available: bool,
    pub current_version: String,
    pub latest_version: Option<String>,
    pub release_notes: Option<String>,
    pub download_url: Option<String>,
    pub published_at: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GithubRelease {
    tag_name: String,
    body: Option<String>,
    published_at: Option<String>,
    assets: Vec<GithubAsset>,
}

#[derive(Debug, Deserialize)]
struct GithubAsset {
    name: String,
    browser_download_url: String,
}

fn get_platform_asset_name() -> String {
    let os = if cfg!(target_os = "macos") {
        "macos"
    } else if cfg!(target_os = "windows") {
        "windows"
    } else {
        "linux"
    };

    let arch = if cfg!(target_arch = "aarch64") {
        "arm64"
    } else {
        "x64"
    };

    let ext = if cfg!(target_os = "windows") { ".exe" } else { "" };

    format!("narrafork-{}-{}{}", os, arch, ext)
}

fn updates_dir() -> PathBuf {
    dirs::home_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join(".narrafork")
        .join("updates")
}

#[tauri::command]
pub async fn check_for_updates() -> Result<UpdateInfo, String> {
    let client = reqwest::Client::builder()
        .user_agent("NarraFork-Launcher")
        .build()
        .map_err(|e| e.to_string())?;

    let response = client
        .get(GITHUB_RELEASES_URL)
        .send()
        .await
        .map_err(|e| format!("Failed to check updates: {}", e))?;

    if !response.status().is_success() {
        return Ok(UpdateInfo {
            available: false,
            current_version: CURRENT_VERSION.to_string(),
            latest_version: None,
            release_notes: None,
            download_url: None,
            published_at: None,
        });
    }

    let release: GithubRelease = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse release info: {}", e))?;

    let latest_version = release.tag_name.trim_start_matches('v').to_string();
    let available = version_compare(&latest_version, CURRENT_VERSION);

    let asset_name = get_platform_asset_name();
    let download_url = release
        .assets
        .iter()
        .find(|a| a.name.contains(&asset_name))
        .map(|a| a.browser_download_url.clone());

    Ok(UpdateInfo {
        available,
        current_version: CURRENT_VERSION.to_string(),
        latest_version: Some(latest_version),
        release_notes: release.body,
        download_url,
        published_at: release.published_at,
    })
}

fn version_compare(latest: &str, current: &str) -> bool {
    let parse = |v: &str| -> Vec<u32> {
        v.split('.')
            .filter_map(|s| s.parse().ok())
            .collect()
    };

    let latest_parts = parse(latest);
    let current_parts = parse(current);

    for (l, c) in latest_parts.iter().zip(current_parts.iter()) {
        if l > c {
            return true;
        }
        if l < c {
            return false;
        }
    }

    latest_parts.len() > current_parts.len()
}

#[tauri::command]
pub async fn download_update(url: String) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .user_agent("NarraFork-Launcher")
        .build()
        .map_err(|e| e.to_string())?;

    let response = client
        .get(&url)
        .send()
        .await
        .map_err(|e| format!("Failed to download: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Download failed with status: {}", response.status()));
    }

    let bytes = response
        .bytes()
        .await
        .map_err(|e| format!("Failed to read download: {}", e))?;

    // Extract filename from URL
    let filename = url
        .split('/')
        .last()
        .unwrap_or("narrafork-update");

    let updates_path = updates_dir();
    fs::create_dir_all(&updates_path).map_err(|e| e.to_string())?;

    let file_path = updates_path.join(filename);
    fs::write(&file_path, &bytes).map_err(|e| format!("Failed to save update: {}", e))?;

    // Make executable on Unix
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = fs::metadata(&file_path)
            .map_err(|e| e.to_string())?
            .permissions();
        perms.set_mode(0o755);
        fs::set_permissions(&file_path, perms).map_err(|e| e.to_string())?;
    }

    Ok(file_path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn get_current_version() -> String {
    CURRENT_VERSION.to_string()
}

#[tauri::command]
pub async fn download_worker_to_dir(dir: String) -> Result<String, String> {
    // Check for latest release to find the worker download URL
    let client = reqwest::Client::builder()
        .user_agent("NarraFork-Launcher")
        .build()
        .map_err(|e| e.to_string())?;

    let response = client
        .get(GITHUB_RELEASES_URL)
        .send()
        .await
        .map_err(|e| format!("Failed to check releases: {}", e))?;

    if !response.status().is_success() {
        return Err(format!("Failed to fetch releases: {}", response.status()));
    }

    let release: GithubRelease = response
        .json()
        .await
        .map_err(|e| format!("Failed to parse release: {}", e))?;

    let asset_name = get_platform_asset_name();
    let download_url = release
        .assets
        .iter()
        .find(|a| a.name.contains(&asset_name))
        .map(|a| a.browser_download_url.clone())
        .ok_or_else(|| format!("No worker binary found for this platform ({})", asset_name))?;

    // Download the worker binary
    let dl_response = client
        .get(&download_url)
        .send()
        .await
        .map_err(|e| format!("Failed to download: {}", e))?;

    if !dl_response.status().is_success() {
        return Err(format!("Download failed with status: {}", dl_response.status()));
    }

    let bytes = dl_response
        .bytes()
        .await
        .map_err(|e| format!("Failed to read download: {}", e))?;

    // Extract filename from URL
    let filename = download_url
        .split('/')
        .last()
        .unwrap_or(&asset_name);

    let dir_path = PathBuf::from(&dir);
    fs::create_dir_all(&dir_path).map_err(|e| format!("Failed to create directory: {}", e))?;

    let file_path = dir_path.join(filename);
    fs::write(&file_path, &bytes).map_err(|e| format!("Failed to save worker: {}", e))?;

    // Make executable on Unix
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mut perms = fs::metadata(&file_path)
            .map_err(|e| e.to_string())?
            .permissions();
        perms.set_mode(0o755);
        fs::set_permissions(&file_path, perms).map_err(|e| e.to_string())?;
    }

    Ok(file_path.to_string_lossy().to_string())
}

#[tauri::command]
pub fn get_pending_update() -> Option<String> {
    let updates_path = updates_dir();
    if !updates_path.exists() {
        return None;
    }

    fs::read_dir(&updates_path)
        .ok()?
        .filter_map(|e| e.ok())
        .map(|e| e.path())
        .find(|p| {
            let name = p.file_name().and_then(|n| n.to_str()).unwrap_or("");
            name.starts_with("narrafork") && !name.contains("launcher") && !name.ends_with(".tmp")
        })
        .map(|p| p.to_string_lossy().to_string())
}
