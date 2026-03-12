//! NarraFork Launcher GUI - Configuration Management

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkerConfig {
    pub path: Option<String>,
    pub port: u16,
    pub host: String,
    pub auto_start: bool,
}

impl Default for WorkerConfig {
    fn default() -> Self {
        Self {
            path: None,
            port: 7779,
            host: "127.0.0.1".to_string(),
            auto_start: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LaunchConfig {
    /// "inline" or "external"
    pub mode: String,
    /// "minimize" or "quit"
    pub close_action: String,
}

impl Default for LaunchConfig {
    fn default() -> Self {
        Self {
            mode: "inline".to_string(),
            close_action: "minimize".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GitConfig {
    pub name: String,
    pub email: String,
}

impl Default for GitConfig {
    fn default() -> Self {
        Self {
            name: String::new(),
            email: String::new(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateConfig {
    pub auto_check: bool,
    /// "stable" or "beta"
    pub channel: String,
}

impl Default for UpdateConfig {
    fn default() -> Self {
        Self {
            auto_check: true,
            channel: "stable".to_string(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct LauncherConfig {
    pub worker: WorkerConfig,
    pub launch: LaunchConfig,
    pub git: GitConfig,
    pub updates: UpdateConfig,
}

impl LauncherConfig {
    pub fn config_path() -> PathBuf {
        dirs::home_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join(".narrafork")
            .join("launcher-config.json")
    }

    pub fn load() -> Self {
        let path = Self::config_path();
        if path.exists() {
            match fs::read_to_string(&path) {
                Ok(content) => serde_json::from_str(&content).unwrap_or_default(),
                Err(_) => Self::default(),
            }
        } else {
            Self::default()
        }
    }

    pub fn save(&self) -> Result<(), String> {
        let path = Self::config_path();
        
        // Ensure parent directory exists
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent).map_err(|e| e.to_string())?;
        }

        let content = serde_json::to_string_pretty(self).map_err(|e| e.to_string())?;
        fs::write(&path, content).map_err(|e| e.to_string())?;
        Ok(())
    }
}

// Tauri commands
#[tauri::command]
pub fn get_config() -> LauncherConfig {
    LauncherConfig::load()
}

#[tauri::command]
pub fn save_config(config: LauncherConfig) -> Result<(), String> {
    config.save()
}

#[tauri::command]
pub fn get_config_path() -> String {
    LauncherConfig::config_path().to_string_lossy().to_string()
}
