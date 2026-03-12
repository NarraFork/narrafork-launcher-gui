//! NarraFork Launcher GUI - Dependency Detection and Installation

use serde::{Deserialize, Serialize};
use std::process::Command;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DependencyInfo {
    pub name: String,
    pub display_name: String,
    pub description: String,
    pub required: bool,
    pub installed: bool,
    pub version: Option<String>,
    pub install_url: String,
}

fn check_command(cmd: &str, version_arg: &str) -> (bool, Option<String>) {
    match Command::new(cmd).arg(version_arg).output() {
        Ok(output) => {
            if output.status.success() {
                let version = String::from_utf8_lossy(&output.stdout)
                    .lines()
                    .next()
                    .map(|s| s.trim().to_string());
                (true, version)
            } else {
                (false, None)
            }
        }
        Err(_) => (false, None),
    }
}

fn get_git_config(key: &str) -> Option<String> {
    Command::new("git")
        .args(["config", "--global", key])
        .output()
        .ok()
        .filter(|o| o.status.success())
        .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
        .filter(|s| !s.is_empty())
}

#[tauri::command]
pub fn check_dependencies() -> Vec<DependencyInfo> {
    let mut deps = Vec::new();

    // Git (required)
    let (git_installed, git_version) = check_command("git", "--version");
    deps.push(DependencyInfo {
        name: "git".to_string(),
        display_name: "Git".to_string(),
        description: "Version control system (required)".to_string(),
        required: true,
        installed: git_installed,
        version: git_version,
        install_url: "https://git-scm.com/downloads".to_string(),
    });

    // ripgrep (recommended)
    let (rg_installed, rg_version) = check_command("rg", "--version");
    deps.push(DependencyInfo {
        name: "rg".to_string(),
        display_name: "ripgrep".to_string(),
        description: "Fast search tool (recommended for better performance)".to_string(),
        required: false,
        installed: rg_installed,
        version: rg_version,
        install_url: "https://github.com/BurntSushi/ripgrep/releases".to_string(),
    });

    // Podman (optional, Linux only)
    #[cfg(target_os = "linux")]
    {
        let (podman_installed, podman_version) = check_command("podman", "--version");
        deps.push(DependencyInfo {
            name: "podman".to_string(),
            display_name: "Podman".to_string(),
            description: "Container runtime (optional, for isolated environments)".to_string(),
            required: false,
            installed: podman_installed,
            version: podman_version,
            install_url: "https://podman.io/getting-started/installation".to_string(),
        });
    }

    deps
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitUserConfig {
    pub name: Option<String>,
    pub email: Option<String>,
}

#[tauri::command]
pub fn get_git_user_config() -> GitUserConfig {
    GitUserConfig {
        name: get_git_config("user.name"),
        email: get_git_config("user.email"),
    }
}

#[tauri::command]
pub fn set_git_user_config(name: String, email: String) -> Result<(), String> {
    if !name.is_empty() {
        Command::new("git")
            .args(["config", "--global", "user.name", &name])
            .output()
            .map_err(|e| format!("Failed to set git user.name: {}", e))?;
    }

    if !email.is_empty() {
        Command::new("git")
            .args(["config", "--global", "user.email", &email])
            .output()
            .map_err(|e| format!("Failed to set git user.email: {}", e))?;
    }

    Ok(())
}

#[tauri::command]
pub fn open_install_url(url: String) -> Result<(), String> {
    open::that(&url).map_err(|e| format!("Failed to open URL: {}", e))
}
