import { useEffect, useState } from "react";
import { Group, ActionIcon, Box, Text } from "@mantine/core";
import { IconMinus, IconSquare, IconX } from "@tabler/icons-react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { platform } from "@tauri-apps/plugin-os";
import { useTranslation } from "react-i18next";

const appWindow = getCurrentWindow();

function handleDragStart(e: React.MouseEvent) {
  if (e.button !== 0) return;
  e.preventDefault();
  appWindow.startDragging();
}

function handleDoubleClick() {
  appWindow.isMaximized().then((maximized) => {
    maximized ? appWindow.unmaximize() : appWindow.maximize();
  });
}

export function TitleBar() {
  const { t } = useTranslation();
  const [isMac, setIsMac] = useState(false);

  useEffect(() => {
    setIsMac(platform() === "macos");
  }, []);

  if (isMac) {
    return (
      <Box
        h={40}
        px="md"
        style={{
          display: "flex",
          alignItems: "center",
          flexShrink: 0,
          cursor: "default",
          borderBottom: "1px solid var(--mantine-color-default-border)",
        }}
        onMouseDown={handleDragStart}
        onDoubleClick={handleDoubleClick}
      >
        {/* Traffic light buttons occupy ~70px on macOS */}
        <Box style={{ width: 70, flexShrink: 0 }} />
        <Text size="xs" fw={600} style={{ flex: 1, textAlign: "center" }}>
          NarraFork Launcher
        </Text>
        <Box style={{ width: 70, flexShrink: 0 }} />
      </Box>
    );
  }

  return (
    <Box
      h={40}
      px="md"
      style={{
        display: "flex",
        alignItems: "center",
        flexShrink: 0,
        cursor: "default",
        borderBottom: "1px solid var(--mantine-color-default-border)",
      }}
      onMouseDown={handleDragStart}
      onDoubleClick={handleDoubleClick}
    >
      <Text size="xs" fw={600} style={{ flex: 1 }}>
          NarraFork Launcher
      </Text>
      <Group gap={0} onMouseDown={(e) => e.stopPropagation()}>
        <ActionIcon variant="subtle" color="gray" size={32} radius={0} onClick={() => appWindow.minimize()}>
          <IconMinus size={14} />
        </ActionIcon>
        <ActionIcon
          variant="subtle"
          color="gray"
          size={32}
          radius={0}
          onClick={async () => {
            const maximized = await appWindow.isMaximized();
            maximized ? appWindow.unmaximize() : appWindow.maximize();
          }}
        >
          <IconSquare size={12} />
        </ActionIcon>
        <ActionIcon variant="subtle" color="red" size={32} radius={0} onClick={() => appWindow.close()}>
          <IconX size={14} />
        </ActionIcon>
      </Group>
    </Box>
  );
}
