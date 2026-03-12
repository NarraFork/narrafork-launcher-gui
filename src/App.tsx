import { useState } from "react";
import {
  MantineProvider,
  Group,
  Button,
  Text,
  Badge,
  Box,
  UnstyledButton,
  ScrollArea,
  Tooltip,
  ColorSchemeScript,
  createTheme,
  useMantineColorScheme,
} from "@mantine/core";
import "@mantine/core/styles.css";
import {
  IconRocket,
  IconPlayerStop,
  IconSettings,
  IconPackage,
  IconRefresh,
  IconMessageCircle,
  IconExternalLink,
  IconTerminal2,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useWorkerStatus } from "./hooks/useTauri";
import { api } from "./lib/api";
import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { TitleBar } from "./components/TitleBar";
import { Terminal } from "./components/Terminal";
import { Settings } from "./components/Settings";
import { Dependencies } from "./components/Dependencies";
import { Updates } from "./components/Updates";
import { Feedback } from "./components/Feedback";

const theme = createTheme({
  primaryColor: "indigo",
  defaultRadius: "md",
});

function formatUptime(secs: number): string {
  if (secs < 60) return `${secs}s`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m`;
  return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`;
}

const NAV_ITEMS = [
  { value: "terminal", icon: IconTerminal2 },
  { value: "settings", icon: IconSettings },
  { value: "deps", icon: IconPackage },
  { value: "updates", icon: IconRefresh },
  { value: "feedback", icon: IconMessageCircle },
] as const;

type TabValue = (typeof NAV_ITEMS)[number]["value"];

function AppContent() {
  const { t } = useTranslation();
  const { status, refresh: refreshStatus } = useWorkerStatus();
  const { colorScheme } = useMantineColorScheme();
  const [starting, setStarting] = useState(false);
  const [stopping, setStopping] = useState(false);
  const [activeTab, setActiveTab] = useState<TabValue>("terminal");

  const handleStart = async () => {
    setStarting(true);
    try {
      const theme = colorScheme === "light" ? "light" : colorScheme === "dark" ? "dark" : "auto";
      await api.startWorker(undefined, undefined, undefined, theme);
      await refreshStatus();
    } catch (e) {
      console.error("Failed to start:", e);
    } finally {
      setStarting(false);
    }
  };

  const handleStop = async () => {
    setStopping(true);
    try {
      await api.stopWorker();
      await refreshStatus();
    } catch (e) {
      console.error("Failed to stop:", e);
    } finally {
      setStopping(false);
    }
  };

  const handleOpenBrowser = async () => {
    try {
      // Rust command handles external browser; returns the URL for inline mode
      const url = await api.openInBrowser();
      const config = await api.getConfig();

      if (config.launch.mode === "inline") {
        // Check if window already exists
        const existing = await WebviewWindow.getByLabel("narrafork-app");
        if (existing) {
          await existing.show();
          await existing.setFocus();
          return;
        }

        // Create the window from JS — avoids Rust main-thread deadlock
        // Load wrapper page with titlebar + iframe pointing to worker URL
        const theme = colorScheme === "light" ? "light" : "dark";
        const webview = new WebviewWindow("narrafork-app", {
          url: `browser.html?url=${encodeURIComponent(url)}&theme=${theme}`,
          title: "NarraFork Launcher",
          width: 1280,
          height: 800,
          minWidth: 800,
          minHeight: 500,
          center: true,
          decorations: false,
        });

        webview.once("tauri://error", (e) => {
          console.error("Failed to create inline window:", e);
        });
      }
    } catch (e) {
      console.error("Failed to open browser:", e);
    }
  };

  const renderPage = () => {
    switch (activeTab) {
      case "settings":
        return <Settings onNavigate={setActiveTab} />;
      case "deps":
        return <Dependencies />;
      case "updates":
        return <Updates />;
      case "feedback":
        return <Feedback />;
      default:
        return null;
    }
  };

  return (
    <Box style={{ display: "flex", flexDirection: "column", height: "100vh", overflow: "hidden" }}>
      <TitleBar />

      <Box style={{ display: "flex", flex: 1, overflow: "hidden" }}>
        {/* Icon rail sidebar */}
        <Box
          style={{
            width: 56,
            flexShrink: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            borderRight: "1px solid var(--mantine-color-default-border)",
            paddingTop: 8,
            paddingBottom: 8,
            gap: 4,
          }}
        >
          {NAV_ITEMS.map((item) => (
            <Tooltip key={item.value} label={t(`tabs.${item.value}`)} position="right" withArrow>
              <UnstyledButton
                onClick={() => setActiveTab(item.value)}
                style={{
                  width: 40,
                  height: 40,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  borderRadius: "var(--mantine-radius-md)",
                  color: activeTab === item.value
                    ? "var(--mantine-color-indigo-filled)"
                    : "var(--mantine-color-dimmed)",
                  background: activeTab === item.value
                    ? "var(--mantine-color-indigo-light)"
                    : "transparent",
                  transition: "all 150ms ease",
                }}
              >
                <item.icon size={20} stroke={activeTab === item.value ? 2 : 1.5} />
              </UnstyledButton>
            </Tooltip>
          ))}

          {/* Spacer */}
          <Box style={{ flex: 1 }} />

          {/* Status indicator at bottom */}
          <Tooltip
            label={
              status?.running
                ? `${t("app.status.running")} - ${t("app.status.port", { port: status.port })}`
                : t("app.status.stopped")
            }
            position="right"
            withArrow
          >
            <Box
              style={{
                width: 10,
                height: 10,
                borderRadius: "50%",
                background: status?.running
                  ? "var(--mantine-color-green-6)"
                  : "var(--mantine-color-gray-6)",
                marginBottom: 4,
              }}
            />
          </Tooltip>
        </Box>

        {/* Main content area */}
        <Box style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Top bar: status + actions */}
          <Box
            px="md"
            py="xs"
            style={{
              borderBottom: "1px solid var(--mantine-color-default-border)",
              flexShrink: 0,
            }}
          >
            <Group justify="space-between">
              <Group gap="sm">
                <Text size="sm" fw={600}>{t(`tabs.${activeTab}`)}</Text>
                <Badge
                  color={status?.running ? "green" : "gray"}
                  variant="dot"
                  size="sm"
                >
                  {status?.running ? t("app.status.running") : t("app.status.stopped")}
                </Badge>
                {status?.running && status.uptimeSecs != null && (
                  <Text size="xs" c="dimmed">
                    {t("app.status.uptime", { time: formatUptime(status.uptimeSecs) })}
                  </Text>
                )}
              </Group>
              <Group gap="xs">
                {status?.running ? (
                  <>
                    <Button
                      size="compact-sm"
                      variant="light"
                      leftSection={<IconExternalLink size={14} />}
                      onClick={handleOpenBrowser}
                    >
                      {t("app.actions.open")}
                    </Button>
                    <Button
                      size="compact-sm"
                      variant="light"
                      color="red"
                      leftSection={<IconPlayerStop size={14} />}
                      onClick={handleStop}
                      loading={stopping}
                    >
                      {t("app.actions.stop")}
                    </Button>
                  </>
                ) : (
                  <Button
                    size="compact-sm"
                    leftSection={<IconRocket size={14} />}
                    onClick={handleStart}
                    loading={starting}
                  >
                    {t("app.actions.start")}
                  </Button>
                )}
              </Group>
            </Group>
          </Box>

          {/* Content panel — Terminal is always mounted, hidden when not active */}
          <Box
            p="md"
            style={{
              flex: 1,
              overflow: "hidden",
              display: activeTab === "terminal" ? "flex" : "none",
              flexDirection: "column",
            }}
          >
            <Terminal />
          </Box>
          {activeTab !== "terminal" && (
            <ScrollArea style={{ flex: 1 }} type="hover" scrollbarSize={6}>
              <Box p="md">
                {renderPage()}
              </Box>
            </ScrollArea>
          )}
        </Box>
      </Box>
    </Box>
  );
}

export default function App() {
  return (
    <>
      <ColorSchemeScript defaultColorScheme="dark" />
      <MantineProvider theme={theme} defaultColorScheme="dark">
        <AppContent />
      </MantineProvider>
    </>
  );
}
