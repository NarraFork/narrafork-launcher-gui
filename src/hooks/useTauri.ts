import { useCallback, useEffect, useState } from "react";
import { api, type WorkerStatus, type LauncherConfig, type DependencyInfo, type UpdateInfo, type GitUserConfig } from "../lib/api";

export function useWorkerStatus() {
  const [status, setStatus] = useState<WorkerStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const s = await api.getWorkerStatus();
      setStatus(s);
    } catch (e) {
      console.error("Failed to get worker status:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
    const interval = setInterval(refresh, 2000);
    return () => clearInterval(interval);
  }, [refresh]);

  return { status, loading, refresh };
}

export function useConfig() {
  const [config, setConfig] = useState<LauncherConfig | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const c = await api.getConfig();
      setConfig(c);
    } catch (e) {
      console.error("Failed to load config:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  const save = useCallback(async (newConfig: LauncherConfig) => {
    try {
      await api.saveConfig(newConfig);
      setConfig(newConfig);
    } catch (e) {
      console.error("Failed to save config:", e);
      throw e;
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { config, loading, save, reload: load };
}

export function useDependencies() {
  const [deps, setDeps] = useState<DependencyInfo[]>([]);
  const [gitConfig, setGitConfig] = useState<GitUserConfig | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const [d, g] = await Promise.all([
        api.checkDependencies(),
        api.getGitUserConfig(),
      ]);
      setDeps(d);
      setGitConfig(g);
    } catch (e) {
      console.error("Failed to check dependencies:", e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { deps, gitConfig, loading, refresh };
}

export function useUpdates() {
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null);
  const [checking, setChecking] = useState(false);
  const [downloading, setDownloading] = useState(false);

  const check = useCallback(async () => {
    setChecking(true);
    try {
      const info = await api.checkForUpdates();
      setUpdateInfo(info);
      return info;
    } catch (e) {
      console.error("Failed to check updates:", e);
      throw e;
    } finally {
      setChecking(false);
    }
  }, []);

  const download = useCallback(async (url: string) => {
    setDownloading(true);
    try {
      const path = await api.downloadUpdate(url);
      return path;
    } catch (e) {
      console.error("Failed to download update:", e);
      throw e;
    } finally {
      setDownloading(false);
    }
  }, []);

  return { updateInfo, checking, downloading, check, download };
}
