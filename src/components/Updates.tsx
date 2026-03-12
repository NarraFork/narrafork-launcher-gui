import { useCallback, useEffect, useState } from "react";
import {
  Stack,
  Paper,
  Text,
  Group,
  Button,
  Badge,
  Loader,
  ScrollArea,
  Table,
} from "@mantine/core";
import {
  IconDownload,
  IconFolder,
  IconRefresh,
  IconTrash,
  IconArrowUp,
} from "@tabler/icons-react";
import { open as dialogOpen } from "@tauri-apps/plugin-dialog";
import { useTranslation } from "react-i18next";
import { useUpdates, useWorkerStatus, useConfig } from "../hooks/useTauri";
import { api, type ServiceWorkerInfo } from "../lib/api";

export function Updates() {
  const { t } = useTranslation();
  const { updateInfo, checking, downloading, check, download } = useUpdates();
  const { status } = useWorkerStatus();
  const { config, save } = useConfig();

  // Download worker to custom directory
  const [workerDownloading, setWorkerDownloading] = useState(false);
  const [workerDownloadResult, setWorkerDownloadResult] = useState<string | null>(null);

  // Service Workers state
  const [swList, setSwList] = useState<ServiceWorkerInfo[]>([]);
  const [swLoading, setSwLoading] = useState(false);
  const [swAction, setSwAction] = useState<"" | "unregister" | "update">("");

  const refreshSW = useCallback(async () => {
    if (!status?.running) {
      setSwList([]);
      return;
    }
    setSwLoading(true);
    try {
      const list = await api.getServiceWorkers();
      setSwList(list);
    } catch {
      setSwList([]);
    } finally {
      setSwLoading(false);
    }
  }, [status?.running]);

  useEffect(() => {
    check();
  }, []);

  useEffect(() => {
    refreshSW();
  }, [refreshSW]);

  const handleDownload = async () => {
    if (!updateInfo?.downloadUrl) return;
    try {
      await download(updateInfo.downloadUrl);
      await api.restartWorker();
    } catch (e) {
      console.error("Download failed:", e);
    }
  };

  const handleUnregisterSW = async () => {
    setSwAction("unregister");
    try {
      await api.unregisterServiceWorkers();
      await refreshSW();
    } catch {
      // ignore
    } finally {
      setSwAction("");
    }
  };

  const handleUpdateSW = async () => {
    setSwAction("update");
    try {
      await api.updateServiceWorkers();
      await refreshSW();
    } catch {
      // ignore
    } finally {
      setSwAction("");
    }
  };

  return (
    <Stack gap="md">
      {/* Version info */}
      <Paper p="md" withBorder>
        <Group justify="space-between" mb="md">
          <Text fw={500}>{t("updates.versionInfo")}</Text>
          <Button
            size="xs"
            variant="subtle"
            leftSection={<IconRefresh size={14} />}
            onClick={check}
            loading={checking}
          >
            {t("updates.checkNow")}
          </Button>
        </Group>

        {checking && !updateInfo ? (
          <Group gap="sm">
            <Loader size="sm" />
            <Text size="sm" c="dimmed">{t("updates.checking")}</Text>
          </Group>
        ) : updateInfo ? (
          <Stack gap="sm">
            <Group gap="md">
              <div>
                <Text size="xs" c="dimmed">{t("updates.currentVersion")}</Text>
                <Text fw={500}>{updateInfo.currentVersion}</Text>
              </div>
              {updateInfo.latestVersion && (
                <div>
                  <Text size="xs" c="dimmed">{t("updates.latestVersion")}</Text>
                  <Group gap="xs">
                    <Text fw={500}>{updateInfo.latestVersion}</Text>
                    {updateInfo.available && (
                      <Badge color="green" size="sm">{t("updates.new")}</Badge>
                    )}
                  </Group>
                </div>
              )}
            </Group>

            {updateInfo.available && updateInfo.downloadUrl && (
              <Button
                leftSection={downloading ? <Loader size={14} /> : <IconDownload size={14} />}
                onClick={handleDownload}
                disabled={downloading}
              >
                {downloading ? t("updates.downloading") : t("updates.downloadInstall")}
              </Button>
            )}

            {!updateInfo.available && (
              <Text size="sm" c="dimmed">{t("updates.upToDate")}</Text>
            )}
          </Stack>
        ) : (
          <Text size="sm" c="dimmed">{t("updates.unavailable")}</Text>
        )}
      </Paper>

      {/* Download Worker */}
      <Paper p="md" withBorder>
        <Text fw={500} mb="xs">{t("updates.worker.title")}</Text>
        <Text size="xs" c="dimmed" mb="md">{t("updates.worker.desc")}</Text>
        {workerDownloadResult && (
          <Text size="xs" c="green" mb="sm">{t("updates.worker.success", { path: workerDownloadResult })}</Text>
        )}
        <Button
          leftSection={workerDownloading ? <Loader size={14} /> : <IconFolder size={14} />}
          onClick={async () => {
            const dir = await dialogOpen({ directory: true, multiple: false });
            if (!dir) return;
            setWorkerDownloading(true);
            setWorkerDownloadResult(null);
            try {
              const savedPath = await api.downloadWorkerToDir(dir as string);
              setWorkerDownloadResult(savedPath);
              // Auto-update worker path in config
              if (config) {
                await save({ ...config, worker: { ...config.worker, path: savedPath } });
              }
            } catch (e) {
              console.error("Download worker failed:", e);
            } finally {
              setWorkerDownloading(false);
            }
          }}
          disabled={workerDownloading}
        >
          {workerDownloading ? t("updates.worker.downloading") : t("updates.worker.download")}
        </Button>
      </Paper>

      {/* Release notes */}
      {updateInfo?.releaseNotes && (
        <Paper p="md" withBorder>
          <Text fw={500} mb="sm">{t("updates.releaseNotes")}</Text>
          <ScrollArea h={150}>
            <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
              {updateInfo.releaseNotes}
            </Text>
          </ScrollArea>
        </Paper>
      )}

      {/* Service Workers */}
      <Paper p="md" withBorder>
        <Group justify="space-between" mb="xs">
          <Text fw={500}>{t("updates.sw.title")}</Text>
          <Button
            size="xs"
            variant="subtle"
            leftSection={<IconRefresh size={14} />}
            onClick={refreshSW}
            loading={swLoading}
            disabled={!status?.running}
          >
            {t("updates.sw.refresh")}
          </Button>
        </Group>
        <Text size="xs" c="dimmed" mb="md">{t("updates.sw.desc")}</Text>

        {!status?.running ? (
          <Text size="sm" c="dimmed">{t("updates.sw.notRunning")}</Text>
        ) : swLoading ? (
          <Group gap="sm">
            <Loader size="sm" />
          </Group>
        ) : swList.length === 0 ? (
          <Text size="sm" c="dimmed">{t("updates.sw.empty")}</Text>
        ) : (
          <Table striped highlightOnHover withTableBorder mb="sm" fz="xs">
            <Table.Thead>
              <Table.Tr>
                <Table.Th>{t("updates.sw.scope")}</Table.Th>
                <Table.Th>{t("updates.sw.state")}</Table.Th>
              </Table.Tr>
            </Table.Thead>
            <Table.Tbody>
              {swList.map((sw, i) => (
                <Table.Tr key={i}>
                  <Table.Td>
                    <Text size="xs" style={{ fontFamily: "monospace" }}>{sw.scope}</Text>
                  </Table.Td>
                  <Table.Td>
                    <Badge
                      size="xs"
                      color={sw.state === "activated" ? "green" : "yellow"}
                      variant="light"
                    >
                      {sw.state}
                    </Badge>
                  </Table.Td>
                </Table.Tr>
              ))}
            </Table.Tbody>
          </Table>
        )}

        {status?.running && (
          <Group gap="xs" mt="sm">
            <Button
              size="xs"
              variant="light"
              color="red"
              leftSection={<IconTrash size={14} />}
              onClick={handleUnregisterSW}
              loading={swAction === "unregister"}
              disabled={!!swAction}
            >
              {t("updates.sw.unregister")}
            </Button>
            <Button
              size="xs"
              variant="light"
              leftSection={<IconArrowUp size={14} />}
              onClick={handleUpdateSW}
              loading={swAction === "update"}
              disabled={!!swAction}
            >
              {t("updates.sw.update")}
            </Button>
          </Group>
        )}
      </Paper>
    </Stack>
  );
}
