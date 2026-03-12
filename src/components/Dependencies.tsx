import { useState } from "react";
import {
  Stack,
  Paper,
  Text,
  Group,
  Badge,
  Button,
  TextInput,
} from "@mantine/core";
import {
  IconCheck,
  IconX,
  IconAlertTriangle,
  IconExternalLink,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { useDependencies } from "../hooks/useTauri";
import { api } from "../lib/api";

export function Dependencies() {
  const { t } = useTranslation();
  const { deps, gitConfig, loading, refresh } = useDependencies();
  const [gitName, setGitName] = useState("");
  const [gitEmail, setGitEmail] = useState("");
  const [savingGit, setSavingGit] = useState(false);

  // Initialize git fields when config loads
  if (gitConfig && !gitName && !gitEmail) {
    if (gitConfig.name) setGitName(gitConfig.name);
    if (gitConfig.email) setGitEmail(gitConfig.email);
  }

  const handleSaveGit = async () => {
    setSavingGit(true);
    try {
      await api.setGitUserConfig(gitName, gitEmail);
      await refresh();
    } catch (e) {
      console.error("Failed to save git config:", e);
    } finally {
      setSavingGit(false);
    }
  };

  const handleInstall = async (url: string) => {
    await api.openInstallUrl(url);
  };

  if (loading) {
    return <Text>{t("deps.checking")}</Text>;
  }

  return (
    <Stack gap="md">
      <Paper p="md" withBorder>
        <Text fw={500} mb="sm">{t("deps.tools")}</Text>
        <Stack gap="xs">
          {deps.map((dep) => (
            <Group key={dep.name} justify="space-between" wrap="nowrap">
              <Group gap="sm" wrap="nowrap">
                {dep.installed ? (
                  <IconCheck size={18} color="var(--mantine-color-green-6)" />
                ) : dep.required ? (
                  <IconX size={18} color="var(--mantine-color-red-6)" />
                ) : (
                  <IconAlertTriangle size={18} color="var(--mantine-color-yellow-6)" />
                )}
                <div>
                  <Group gap="xs">
                    <Text size="sm" fw={500}>{dep.displayName}</Text>
                    {dep.required && (
                      <Badge size="xs" color="red" variant="light">{t("deps.required")}</Badge>
                    )}
                    {dep.installed && dep.version && (
                      <Badge size="xs" color="gray" variant="light">{dep.version}</Badge>
                    )}
                  </Group>
                  <Text size="xs" c="dimmed">{dep.description}</Text>
                </div>
              </Group>
              {!dep.installed && (
                <Button
                  size="xs"
                  variant="light"
                  rightSection={<IconExternalLink size={14} />}
                  onClick={() => handleInstall(dep.installUrl)}
                >
                  {t("deps.install")}
                </Button>
              )}
            </Group>
          ))}
        </Stack>
        <Button variant="subtle" size="xs" mt="md" onClick={refresh}>
          {t("deps.refresh")}
        </Button>
      </Paper>

      <Paper p="md" withBorder>
        <Text fw={500} mb="sm">{t("deps.git.title")}</Text>
        <Text size="xs" c="dimmed" mb="md">
          {t("deps.git.description")}
        </Text>
        <Stack gap="sm">
          <TextInput
            label={t("deps.git.name")}
            placeholder={t("deps.git.namePlaceholder")}
            value={gitName}
            onChange={(e) => setGitName(e.target.value)}
          />
          <TextInput
            label={t("deps.git.email")}
            placeholder={t("deps.git.emailPlaceholder")}
            value={gitEmail}
            onChange={(e) => setGitEmail(e.target.value)}
          />
          <Group justify="flex-end">
            <Button
              size="sm"
              onClick={handleSaveGit}
              loading={savingGit}
              disabled={!gitName && !gitEmail}
            >
              {t("deps.git.save")}
            </Button>
          </Group>
        </Stack>
      </Paper>
    </Stack>
  );
}
