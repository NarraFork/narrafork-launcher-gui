import { useEffect, useRef, useState, type ReactNode } from "react";
import { Box, Text, Stack, Group, ActionIcon } from "@mantine/core";
import { IconTrash } from "@tabler/icons-react";
import { listen } from "@tauri-apps/api/event";
import { useTranslation } from "react-i18next";

interface OutputLine {
  stream: "stdout" | "stderr";
  line: string;
  ts: number;
}

const LEVEL_COLORS: Record<string, string> = {
  debug: "#888",
  info: "#6bc96b",
  warn: "#e5c07b",
  error: "#e06c75",
};

// Standard 256-color palette (colors 0-15 match typical terminal)
const ANSI_BASIC: string[] = [
  "#000","#c00","#0a0","#c50","#00a","#c0c","#0aa","#ccc",
  "#555","#f55","#5f5","#ff5","#55f","#f5f","#5ff","#fff",
];

function ansi256ToHex(n: number): string {
  if (n < 16) return ANSI_BASIC[n];
  if (n < 232) {
    const i = n - 16;
    const r = Math.floor(i / 36) * 51;
    const g = Math.floor((i % 36) / 6) * 51;
    const b = (i % 6) * 51;
    return `rgb(${r},${g},${b})`;
  }
  const v = (n - 232) * 10 + 8;
  return `rgb(${v},${v},${v})`;
}

interface AnsiSpan { text: string; color?: string; bold?: boolean; dim?: boolean; }

/** Parse a string with ANSI escape codes into styled spans */
function parseAnsi(raw: string): AnsiSpan[] {
  const spans: AnsiSpan[] = [];
  const re = /\x1b\[([0-9;]*)m/g;
  let last = 0;
  let color: string | undefined;
  let bold = false;
  let dim = false;

  let m: RegExpExecArray | null;
  while ((m = re.exec(raw)) !== null) {
    // Push text before this escape
    if (m.index > last) {
      spans.push({ text: raw.slice(last, m.index), color, bold, dim });
    }
    last = m.index + m[0].length;

    // Parse SGR codes
    const codes = m[1] ? m[1].split(";").map(Number) : [0];
    for (let i = 0; i < codes.length; i++) {
      const c = codes[i];
      if (c === 0) { color = undefined; bold = false; dim = false; }
      else if (c === 1) bold = true;
      else if (c === 2) dim = true;
      else if (c === 22) { bold = false; dim = false; }
      else if (c >= 30 && c <= 37) color = ANSI_BASIC[c - 30];
      else if (c >= 90 && c <= 97) color = ANSI_BASIC[c - 90 + 8];
      else if (c === 39) color = undefined;
      else if (c === 38 && codes[i + 1] === 5) { color = ansi256ToHex(codes[i + 2] || 0); i += 2; }
      else if (c === 38 && codes[i + 1] === 2) { color = `rgb(${codes[i+2]||0},${codes[i+3]||0},${codes[i+4]||0})`; i += 4; }
    }
  }
  // Remaining text
  if (last < raw.length) {
    spans.push({ text: raw.slice(last), color, bold, dim });
  }
  return spans;
}

function stripAnsi(s: string): string {
  return s.replace(/\x1b\[[0-9;]*m/g, "");
}

function hasAnsi(s: string): boolean {
  return /\x1b\[/.test(s);
}

/** Render ANSI spans as React nodes */
function renderAnsi(raw: string, baseColor: string): ReactNode {
  if (!hasAnsi(raw)) return raw;
  const spans = parseAnsi(raw);
  return spans.map((s, i) => (
    <span key={i} style={{
      color: s.color || baseColor,
      fontWeight: s.bold ? 700 : undefined,
      opacity: s.dim ? 0.6 : undefined,
    }}>{s.text}</span>
  ));
}

interface FormattedLine { content: ReactNode; color: string; }

function formatLine(raw: string, isStderr: boolean): FormattedLine {
  const clean = stripAnsi(raw);

  // Try to parse as JSON log line
  try {
    const obj = JSON.parse(clean);
    if (obj && typeof obj === "object" && obj.msg) {
      const level = (obj.level || "info").toLowerCase();
      const color = LEVEL_COLORS[level] || "#d4d4d4";
      const time = obj.ts ? new Date(obj.ts).toLocaleTimeString() : "";
      const tag = level.toUpperCase().padEnd(5);
      const extra = Object.entries(obj)
        .filter(([k]) => !["ts", "level", "msg"].includes(k))
        .map(([k, v]) => `${k}=${v}`)
        .join(" ");
      const text = [time, tag, obj.msg, extra].filter(Boolean).join(" ");
      return { content: text, color };
    }
  } catch { /* not JSON */ }

  // Has ANSI codes — render with colors
  if (hasAnsi(raw)) {
    const baseColor = isStderr ? "#e06c75" : "#d4d4d4";
    return { content: renderAnsi(raw, baseColor), color: baseColor };
  }

  // Plain text
  const color = isStderr ? "#e06c75" : "#d4d4d4";
  return { content: clean, color };
}

export function Terminal() {
  const { t } = useTranslation();
  const [lines, setLines] = useState<OutputLine[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const unlisten = listen<{ stream: string; line: string }>("worker-output", (event) => {
      setLines((prev) => {
        const next = [...prev, {
          stream: event.payload.stream as "stdout" | "stderr",
          line: event.payload.line,
          ts: Date.now(),
        }];
        // Keep last 2000 lines
        return next.length > 2000 ? next.slice(-2000) : next;
      });
    });

    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  return (
    <Stack gap={0} h="100%">
      <Group justify="space-between" mb="xs">
        <Text size="sm" fw={500}>{t("tabs.terminal")}</Text>
        <ActionIcon
          variant="subtle"
          color="gray"
          size="sm"
          onClick={() => setLines([])}
        >
          <IconTrash size={14} />
        </ActionIcon>
      </Group>
      <Box
        style={{
          flex: 1,
          overflow: "auto",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
          fontSize: 12,
          lineHeight: 1.6,
          padding: 8,
          borderRadius: "var(--mantine-radius-sm)",
          background: "#1e1e1e",
          color: "#d4d4d4",
        }}
      >
        {lines.length === 0 ? (
          <Text size="xs" c="dimmed">{t("terminal.empty")}</Text>
        ) : (
          lines.map((item, i) => {
            const { content, color } = formatLine(item.line, item.stream === "stderr");
            return (
              <div
                key={i}
                style={{
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-all",
                  color,
                }}
              >
                {content}
              </div>
            );
          })
        )}
        <div ref={bottomRef} />
      </Box>
    </Stack>
  );
}
