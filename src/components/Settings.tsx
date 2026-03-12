import { useCallback, useState } from "react";
import {
  Stack,
  TextInput,
  NumberInput,
  Select,
  Switch,
  Text,
  Paper,
  Group,
  Button,
  SegmentedControl,
  useMantineColorScheme,
} from "@mantine/core";
import { IconDownload, IconFolder, IconTrash } from "@tabler/icons-react";
import { open } from "@tauri-apps/plugin-dialog";
import { useTranslation } from "react-i18next";
import { useConfig } from "../hooks/useTauri";
import { api } from "../lib/api";
import type { LauncherConfig } from "../lib/api";

interface SettingsProps {
  onNavigate: (tab: "terminal" | "settings" | "deps" | "updates" | "feedback") => void;
}

export function Settings({ onNavigate }: SettingsProps) {
  const { t, i18n } = useTranslation();
  const { colorScheme, setColorScheme } = useMantineColorScheme();
  const { config, loading, save } = useConfig();
  const [clearing, setClearing] = useState(false);

  const update = useCallback(
    (patch: (prev: LauncherConfig) => LauncherConfig) => {
      if (!config) return;
      const next = patch(config);
      save(next).catch((e) => console.error("Save failed:", e));
    },
    [config, save],
  );

  const handleBrowseWorker = async () => {
    const selected = await open({
      multiple: false,
      filters: [{ name: "Executable", extensions: ["exe", ""] }],
    });
    if (selected && config) {
      update((c) => ({
        ...c,
        worker: { ...c.worker, path: selected as string },
      }));
    }
  };

  const handleLanguageChange = (lang: string | null) => {
    if (!lang) return;
    i18n.changeLanguage(lang);
    localStorage.setItem("narrafork-lang", lang);
  };

  if (loading || !config) {
    return <Text>{t("settings.loading")}</Text>;
  }

  return (
    <Stack gap="md">
      <Paper p="md" withBorder>
        <Text fw={500} mb="sm">{t("settings.appearance.title")}</Text>
        <Stack gap="sm">
          <Select
            label={t("settings.appearance.language")}
            data={[
              { value: "en", label: "English" },
              { value: "zh", label: "中文" },
            ]}
            value={i18n.language}
            onChange={handleLanguageChange}
          />
          <div>
            <Text size="sm" fw={500} mb={4}>{t("settings.appearance.theme")}</Text>
            <SegmentedControl
              value={colorScheme}
              onChange={(val) => setColorScheme(val as "light" | "dark")}
              data={[
                { value: "light", label: t("settings.appearance.themeLight") },
                { value: "dark", label: t("settings.appearance.themeDark") },
              ]}
              fullWidth
            />
          </div>
        </Stack>
      </Paper>

      <Paper p="md" withBorder>
        <Text fw={500} mb="sm">{t("settings.worker.title")}</Text>
        <Stack gap="sm">
          <TextInput
            label={t("settings.worker.path")}
            placeholder={t("settings.worker.pathPlaceholder")}
            defaultValue={config.worker.path ?? ""}
            onBlur={(e) =>
              update((c) => ({
                ...c,
                worker: { ...c.worker, path: e.target.value || null },
              }))
            }
            rightSection={
              <IconFolder
                size={18}
                style={{ cursor: "pointer" }}
                onClick={handleBrowseWorker}
              />
            }
          />
          <Group grow>
            <NumberInput
              label={t("settings.worker.port")}
              defaultValue={config.worker.port}
              onBlur={(e) =>
                update((c) => ({
                  ...c,
                  worker: { ...c.worker, port: Number(e.target.value) || 7779 },
                }))
              }
              min={1}
              max={65535}
            />
            <TextInput
              label={t("settings.worker.host")}
              defaultValue={config.worker.host}
              onBlur={(e) =>
                update((c) => ({
                  ...c,
                  worker: { ...c.worker, host: e.target.value },
                }))
              }
            />
          </Group>
          <Switch
            label={t("settings.worker.autoStart")}
            checked={config.worker.autoStart}
            onChange={(e) =>
              update((c) => ({
                ...c,
                worker: { ...c.worker, autoStart: e.currentTarget.checked },
              }))
            }
            styles={{ label: { pointerEvents: "none" } }}
          />
          <Button
            variant="light"
            size="compact-sm"
            leftSection={<IconDownload size={14} />}
            onClick={() => onNavigate("updates")}
          >
            {t("settings.worker.download")}
          </Button>
        </Stack>
      </Paper>

      <Paper p="md" withBorder>
        <Text fw={500} mb="sm">{t("settings.launch.title")}</Text>
        <Stack gap="sm">
          <Select
            label={t("settings.launch.mode")}
            data={[
              { value: "inline", label: t("settings.launch.modeInline") },
              { value: "external", label: t("settings.launch.modeExternal") },
            ]}
            value={config.launch.mode}
            onChange={(val) =>
              update((c) => ({
                ...c,
                launch: { ...c.launch, mode: (val as "inline" | "external") ?? "inline" },
              }))
            }
          />
          <Select
            label={t("settings.launch.closeAction")}
            data={[
              { value: "minimize", label: t("settings.launch.closeMinimize") },
              { value: "quit", label: t("settings.launch.closeQuit") },
            ]}
            value={config.launch.closeAction}
            onChange={(val) =>
              update((c) => ({
                ...c,
                launch: { ...c.launch, closeAction: (val as "minimize" | "quit") ?? "minimize" },
              }))
            }
          />
        </Stack>
      </Paper>

      <Paper p="md" withBorder>
        <Text fw={500} mb="sm">{t("settings.updates.title")}</Text>
        <Stack gap="sm">
          <Switch
            label={t("settings.updates.autoCheck")}
            checked={config.updates.autoCheck}
            onChange={(e) =>
              update((c) => ({
                ...c,
                updates: { ...c.updates, autoCheck: e.currentTarget.checked },
              }))
            }
            styles={{ label: { pointerEvents: "none" } }}
          />
          <Select
            label={t("settings.updates.channel")}
            data={[
              { value: "stable", label: t("settings.updates.stable") },
              { value: "beta", label: t("settings.updates.beta") },
            ]}
            value={config.updates.channel}
            onChange={(val) =>
              update((c) => ({
                ...c,
                updates: { ...c.updates, channel: (val as "stable" | "beta") ?? "stable" },
              }))
            }
          />
        </Stack>
      </Paper>
      <Paper p="md" withBorder>
        <Text fw={500} mb="sm">{t("settings.data.title")}</Text>
        <Text size="xs" c="dimmed" mb="sm">{t("settings.data.clearDesc")}</Text>
        <Button
          variant="light"
          color="red"
          size="compact-sm"
          leftSection={<IconTrash size={14} />}
          loading={clearing}
          onClick={async () => {
            setClearing(true);
            try {
              await api.clearBrowsingData();
              console.log(t("settings.data.clearSuccess"));
            } catch (e) {
              console.error(t("settings.data.clearFail"), e);
            } finally {
              setClearing(false);
            }
          }}
        >
          {t("settings.data.clearBrowsingData")}
        </Button>
      </Paper>
    </Stack>
  );
}
