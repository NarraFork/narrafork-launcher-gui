//! NarraFork Launcher GUI - Worker Process Management

use serde::{Deserialize, Serialize};
use std::io::{BufRead, BufReader};
use std::path::PathBuf;
use std::process::{Child, Command, Stdio};
use std::sync::Mutex;
use std::fs;
use tauri::{AppHandle, Emitter};

use crate::config::LauncherConfig;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkerStatus {
    pub running: bool,
    pub pid: Option<u32>,
    pub port: u16,
    pub path: Option<String>,
    pub uptime_secs: Option<u64>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct WorkerOutputEvent {
    pub stream: String, // "stdout" or "stderr"
    pub line: String,
}

pub struct WorkerState {
    pub process: Option<Child>,
    pub started_at: Option<std::time::Instant>,
    pub path: Option<String>,
    pub port: u16,
}

impl Default for WorkerState {
    fn default() -> Self {
        Self {
            process: None,
            started_at: None,
            path: None,
            port: 7779,
        }
    }
}

/// Find worker executable in a directory
fn find_worker_in_dir(dir: &PathBuf) -> Option<PathBuf> {
    let is_windows = cfg!(target_os = "windows");
    let ext = if is_windows { ".exe" } else { "" };

    // Priority 1: Exact names
    let exact_names = [
        format!("narrafork-worker{}", ext),
        format!("narrafork{}", ext),
    ];

    for name in &exact_names {
        let path = dir.join(name);
        if path.exists() && path.is_file() {
            return Some(path);
        }
    }

    // Priority 2: Versioned names (narrafork-X.Y.Z-platform)
    if let Ok(entries) = fs::read_dir(dir) {
        let mut candidates: Vec<PathBuf> = entries
            .filter_map(|e| e.ok())
            .map(|e| e.path())
            .filter(|p| {
                let name = p.file_name().and_then(|n| n.to_str()).unwrap_or("");
                name.starts_with("narrafork-")
                    && !name.contains("launcher")
                    && p.is_file()
            })
            .collect();

        candidates.sort();
        candidates.reverse(); // Latest version first

        if let Some(path) = candidates.first() {
            return Some(path.clone());
        }
    }

    None
}

/// Find worker executable
fn find_worker(config_path: Option<&str>) -> Option<PathBuf> {
    // If path is specified in config, use it
    if let Some(path) = config_path {
        let p = PathBuf::from(path);
        if p.exists() {
            return Some(p);
        }
    }

    // Try current executable's directory
    if let Ok(exe_path) = std::env::current_exe() {
        if let Some(exe_dir) = exe_path.parent() {
            if let Some(worker) = find_worker_in_dir(&exe_dir.to_path_buf()) {
                return Some(worker);
            }
        }
    }

    // Try common installation paths
    let common_paths = [
        dirs::home_dir().map(|h| h.join(".narrafork").join("bin")),
        Some(PathBuf::from("/opt/narrafork")),
        Some(PathBuf::from("/usr/local/bin")),
    ];

    for path in common_paths.iter().flatten() {
        if let Some(worker) = find_worker_in_dir(path) {
            return Some(worker);
        }
    }

    None
}

#[tauri::command]
pub fn get_worker_status(state: tauri::State<'_, Mutex<WorkerState>>) -> WorkerStatus {
    let mut state = state.lock().unwrap();

    let running = state.process.as_mut().map_or(false, |p| {
        // try_wait returns Ok(None) if the process is still running
        match p.try_wait() {
            Ok(None) => true,    // still running
            Ok(Some(_)) => false, // exited
            Err(_) => false,
        }
    });

    // Clean up state if process has exited
    if !running && state.process.is_some() {
        if let Some(ref mut p) = state.process {
            if p.try_wait().ok().flatten().is_some() {
                state.process = None;
                state.started_at = None;
            }
        }
    }

    let uptime = if running {
        state.started_at.map(|t| t.elapsed().as_secs())
    } else {
        None
    };

    WorkerStatus {
        running,
        pid: state.process.as_ref().map(|p| p.id()),
        port: state.port,
        path: state.path.clone(),
        uptime_secs: uptime,
    }
}

#[tauri::command]
pub fn start_worker(
    app: AppHandle,
    state: tauri::State<'_, Mutex<WorkerState>>,
    path: Option<String>,
    port: Option<u16>,
    host: Option<String>,
    theme: Option<String>,
) -> Result<WorkerStatus, String> {
    let mut state = state.lock().unwrap();

    // Stop existing worker if running
    if let Some(ref mut process) = state.process {
        let _ = process.kill();
        let _ = process.wait();
    }

    let config = LauncherConfig::load();
    let worker_path = find_worker(path.as_deref().or(config.worker.path.as_deref()))
        .ok_or("Worker executable not found")?;

    let port = port.unwrap_or(config.worker.port);
    let host = host.unwrap_or(config.worker.host.clone());

    let mut cmd = Command::new(&worker_path);
    cmd.arg("--no-open")
        .arg(format!("--theme={}", theme.as_deref().unwrap_or("auto")))
        .env("PORT", port.to_string())
        .env("HOST", &host)
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    let mut process = cmd.spawn().map_err(|e| format!("Failed to start worker: {}", e))?;

    let pid = process.id();

    // Spawn background threads to read stdout/stderr and emit events
    if let Some(stdout) = process.stdout.take() {
        let app_clone = app.clone();
        std::thread::spawn(move || {
            let reader = BufReader::new(stdout);
            for line in reader.lines() {
                match line {
                    Ok(line) => {
                        let _ = app_clone.emit("worker-output", WorkerOutputEvent {
                            stream: "stdout".to_string(),
                            line,
                        });
                    }
                    Err(_) => break,
                }
            }
        });
    }

    if let Some(stderr) = process.stderr.take() {
        let app_clone = app.clone();
        std::thread::spawn(move || {
            let reader = BufReader::new(stderr);
            for line in reader.lines() {
                match line {
                    Ok(line) => {
                        let _ = app_clone.emit("worker-output", WorkerOutputEvent {
                            stream: "stderr".to_string(),
                            line,
                        });
                    }
                    Err(_) => break,
                }
            }
        });
    }

    state.process = Some(process);
    state.started_at = Some(std::time::Instant::now());
    state.path = Some(worker_path.to_string_lossy().to_string());
    state.port = port;

    // Emit event
    let _ = app.emit("worker-started", serde_json::json!({
        "pid": pid,
        "port": port,
        "path": worker_path.to_string_lossy()
    }));

    Ok(WorkerStatus {
        running: true,
        pid: Some(pid),
        port,
        path: Some(worker_path.to_string_lossy().to_string()),
        uptime_secs: Some(0),
    })
}

#[tauri::command]
pub fn stop_worker(
    app: AppHandle,
    state: tauri::State<'_, Mutex<WorkerState>>,
) -> Result<(), String> {
    let mut state = state.lock().unwrap();

    if let Some(ref mut process) = state.process {
        process.kill().map_err(|e| format!("Failed to stop worker: {}", e))?;
        let _ = process.wait();
    }

    state.process = None;
    state.started_at = None;

    let _ = app.emit("worker-stopped", ());

    Ok(())
}

#[tauri::command]
pub fn restart_worker(
    app: AppHandle,
    state: tauri::State<'_, Mutex<WorkerState>>,
) -> Result<WorkerStatus, String> {
    let (path, port, host) = {
        let state = state.lock().unwrap();
        (state.path.clone(), state.port, LauncherConfig::load().worker.host)
    };

    stop_worker(app.clone(), state.clone())?;
    start_worker(app, state, path, Some(port), Some(host), None)
}

#[tauri::command]
pub fn find_worker_path() -> Option<String> {
    let config = LauncherConfig::load();
    find_worker(config.worker.path.as_deref())
        .map(|p| p.to_string_lossy().to_string())
}
