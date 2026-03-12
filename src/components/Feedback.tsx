import { Stack, Paper, Text, Button } from "@mantine/core";
import {
  IconBrandQq,
  IconBug,
} from "@tabler/icons-react";
import { useTranslation } from "react-i18next";
import { api } from "../lib/api";

const LINKS = {
  issues: "https://github.com/Narrafork/narrafork-issue/",
  qq: "https://qm.qq.com/q/B8r8ExkkkE",
};

export function Feedback() {
  const { t } = useTranslation();

  const openLink = (url: string) => {
    api.openInstallUrl(url);
  };

  return (
    <Stack gap="md">
      <Paper p="md" withBorder>
        <Text fw={500} mb="sm">{t("feedback.helpTitle")}</Text>
        <Stack gap="sm">
          <Button
            variant="light"
            leftSection={<IconBug size={18} />}
            onClick={() => openLink(LINKS.issues)}
            fullWidth
            justify="flex-start"
          >
            {t("feedback.bug")}
          </Button>
        </Stack>
      </Paper>

      <Paper p="md" withBorder>
        <Text fw={500} mb="sm">{t("feedback.communityTitle")}</Text>
        <Text size="sm" c="dimmed" mb="md">
          {t("feedback.communityDesc")}
        </Text>
        <Button
          variant="light"
          color="indigo"
          leftSection={<IconBrandQq size={18} />}
          onClick={() => openLink(LINKS.qq)}
          fullWidth
          justify="flex-start"
        >
          {t("feedback.qq")}
        </Button>
      </Paper>

      <Paper p="md" withBorder>
        <Text fw={500} mb="sm">{t("feedback.aboutTitle")}</Text>
        <Text size="sm" c="dimmed">
          {t("feedback.aboutDesc")}
        </Text>
        <Text size="xs" c="dimmed" mt="md">
          {t("feedback.madeWith")}
        </Text>
      </Paper>
    </Stack>
  );
}
