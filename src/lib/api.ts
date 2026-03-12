import { invoke } from "@tauri-apps/api/core";

// Config types
export interface WorkerConfig {
  path: string | null;
  port: number;
  host: string;
  autoStart: boolean;
}

export interface LaunchConfig {
  mode: "inline" | "external";
  closeAction: "minimize" | "quit";
}

export interface GitConfig {
  name: string;
  email: string;
}

export interface UpdateConfig {
  autoCheck: boolean;
  channel: "stable" | "beta";
}

export interface LauncherConfig {
  worker: WorkerConfig;
  launch: LaunchConfig;
  git: GitConfig;
  updates: UpdateConfig;
}

// Worker types
export interface WorkerStatus {
  running: boolean;
  pid: number | null;
  port: number;
  path: string | null;
  uptimeSecs: number | null;
}

// Dependency types
export interface DependencyInfo {
  name: string;
  displayName: string;
  description: string;
  required: boolean;
  installed: boolean;
  version: string | null;
  installUrl: string;
}

export interface GitUserConfig {
  name: string | null;
  email: string | null;
}

// Update types
export interface UpdateInfo {
  available: boolean;
  currentVersion: string;
  latestVersion: string | null;
  releaseNotes: string | null;
  downloadUrl: string | null;
  publishedAt: string | null;
}

// Service Worker types
export interface ServiceWorkerInfo {
  scope: string;
  scriptUrl: string;
  state: string;
}

// API functions
export const api = {
  // Config
  getConfig: () => invoke<LauncherConfig>("get_config"),
  saveConfig: (config: LauncherConfig) => invoke<void>("save_config", { config }),
  getConfigPath: () => invoke<string>("get_config_path"),

  // Worker
  getWorkerStatus: () => invoke<WorkerStatus>("get_worker_status"),
  startWorker: (path?: string, port?: number, host?: string, theme?: string) =>
    invoke<WorkerStatus>("start_worker", { path, port, host, theme }),
  stopWorker: () => invoke<void>("stop_worker"),
  restartWorker: () => invoke<WorkerStatus>("restart_worker"),
  findWorkerPath: () => invoke<string | null>("find_worker_path"),

  // Dependencies
  checkDependencies: () => invoke<DependencyInfo[]>("check_dependencies"),
  getGitUserConfig: () => invoke<GitUserConfig>("get_git_user_config"),
  setGitUserConfig: (name: string, email: string) =>
    invoke<void>("set_git_user_config", { name, email }),
  openInstallUrl: (url: string) => invoke<void>("open_install_url", { url }),

  // Updates
  checkForUpdates: () => invoke<UpdateInfo>("check_for_updates"),
  downloadUpdate: (url: string) => invoke<string>("download_update", { url }),
  downloadWorkerToDir: (dir: string) => invoke<string>("download_worker_to_dir", { dir }),
  getCurrentVersion: () => invoke<string>("get_current_version"),
  getPendingUpdate: () => invoke<string | null>("get_pending_update"),

  // Browser — returns the URL, frontend handles inline window creation
  openInBrowser: (port?: number, host?: string) =>
    invoke<string>("open_in_browser", { port, host }),
  closeInlineBrowser: () => invoke<void>("close_inline_browser"),
  clearBrowsingData: () => invoke<void>("clear_browsing_data"),
  getAppUrl: (port?: number, host?: string) =>
    invoke<string>("get_app_url", { port, host }),

  // Service Workers
  getServiceWorkers: (port?: number, host?: string) =>
    invoke<ServiceWorkerInfo[]>("get_service_workers", { port, host }),
  unregisterServiceWorkers: (port?: number, host?: string) =>
    invoke<boolean>("unregister_service_workers", { port, host }),
  updateServiceWorkers: (port?: number, host?: string) =>
    invoke<boolean>("update_service_workers", { port, host }),
};
