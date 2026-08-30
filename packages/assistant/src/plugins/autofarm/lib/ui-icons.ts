// Premium icon library for NEXUS autofarm TUI
// NO emojis — use Unicode box-drawing characters + Braille patterns
// for that Claude Mobile / Linear / Vercel premium feel.

export type IconName =
  | "loading" | "loading_alt"
  | "success" | "success_arrow"
  | "error" | "error_x"
  | "warn" | "warn_triangle"
  | "info" | "info_dot"
  | "arrow_right" | "arrow_down"
  | "vault" | "lock" | "unlock"
  | "key" | "mail" | "browser"
  | "search" | "brain" | "robot"
  | "fire" | "bolt" | "star"
  | "check" | "circle" | "square"
  | "dot_pulse" | "dot_static"
  | "progress_start" | "progress_mid" | "progress_end"
  | "progress_full" | "progress_empty"

// Static icon frames (animation cycles through these)
export const ICONS: Record<IconName, string> = {
  // Loading spinners (Braille patterns - 8 frames for smooth animation)
  loading: "⠋",
  loading_alt: "⠙",
  success: "✓",
  success_arrow: "→",
  error: "✕",
  error_x: "✗",
  warn: "⚠",
  warn_triangle: "▲",
  info: "•",
  info_dot: "◦",
  arrow_right: "▸",
  arrow_down: "▾",
  vault: "▣",
  lock: "▤",
  unlock: "▥",
  key: "⚷",
  mail: "✉",
  browser: "⊟",
  search: "⌕",
  brain: "◈",
  robot: "⊛",
  fire: "✦",
  bolt: "↯",
  star: "★",
  check: "✔",
  circle: "●",
  square: "▪",
  dot_pulse: "●",
  dot_static: "·",
  progress_start: "▕",
  progress_mid: "▔",
  progress_end: "▏",
  progress_full: "█",
  progress_empty: "░",
}

// Animations - cyclic frame arrays
export const ANIM_FRAMES: Record<string, string[]> = {
  spinner: ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"],
  spinner2: ["⣀", "⣄", "⣤", "⣦", "⣶", "⣷", "⣯", "⣟", "⡿", "⢿", "⣻", "⣽", "⣾", "⣷"],
  dots: ["⠁", "⠂", "⠄", "⡀", "⢀", "⠠", "⠐", "⠈"],
  pulse: ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█", "▇", "▆", "▅", "▄", "▃", "▂"],
  wave: ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "▆", "▅", "▄", "▃", "▂"],
  fill: ["▏", "▎", "▍", "▌", "▋", "▊", "▉", "█"],
}

// Multi-frame progress bar (8 stages, animated)
export const PROGRESS_FRAMES = [
  "▏░░░░░░░░░",
  "▎░░░░░░░░░",
  "▍░░░░░░░░░",
  "▌░░░░░░░░░",
  "▋░░░░░░░░░",
  "▊░░░░░░░░░",
  "▉░░░░░░░░░",
  "█░░░░░░░░░",
  "█▏░░░░░░░░",
  "█▎░░░░░░░░",
  "█▍░░░░░░░░",
  "█▌░░░░░░░░",
  "█▋░░░░░░░░",
  "█▊░░░░░░░░",
  "█▉░░░░░░░░",
  "██░░░░░░░░",
  "██▏░░░░░░░",
  "██▎░░░░░░░",
  "██▍░░░░░░░",
  "██▌░░░░░░░",
]

// Get spinner frame at time t (cycles)
export function spinnerFrame(t: number, variant: "spinner" | "spinner2" | "dots" = "spinner"): string {
  const frames = ANIM_FRAMES[variant]
  return frames[Math.floor(t / 100) % frames.length]
}

// Generate a progress bar at percentage p (0..1)
export function progressBar(percent: number, width = 20): string {
  const filled = Math.round(percent * width)
  const empty = width - filled
  return "▕" + "█".repeat(filled) + "░".repeat(empty) + "▏"
}

// Box-drawing characters for premium frames
export const BOX = {
  topLeft: "╭",
  topRight: "╮",
  bottomLeft: "╰",
  bottomRight: "╯",
  horizontal: "─",
  vertical: "│",
  teeLeft: "├",
  teeRight: "┤",
  teeTop: "┬",
  teeBottom: "┴",
  cross: "┼",
  doubleHorizontal: "═",
  doubleVertical: "║",
}

// Color palette inspired by Claude Mobile / Linear / Vercel
export const COLORS = {
  // Primary brand colors
  accent: "#7C3AED",      // Purple (Vercel-ish)
  accentAlt: "#06B6D4",   // Cyan
  accentWarm: "#F59E0B",  // Amber

  // Status colors
  success: "#10B981",     // Emerald
  error: "#EF4444",       // Red
  warn: "#F59E0B",        // Amber
  info: "#3B82F6",        // Blue

  // Text hierarchy
  primary: "#FAFAFA",
  secondary: "#A1A1AA",
  tertiary: "#52525B",
  muted: "#27272A",

  // Backgrounds
  bg: "#0A0A0A",
  bgElevated: "#18181B",
  bgSubtle: "#27272A",
}

// ANSI escape helpers (24-bit color for true-color terminals)
const ESC = "\x1b["
const RESET = `${ESC}0m`

function ansi(fg: string, bg?: string): string {
  return bg ? `${ESC}38;2;${hexToRgb(fg)};48;2;${hexToRgb(bg)}m` : `${ESC}38;2;${hexToRgb(fg)}m`
}

function hexToRgb(hex: string): string {
  const h = hex.replace("#", "")
  const r = parseInt(h.slice(0, 2), 16)
  const g = parseInt(h.slice(2, 4), 16)
  const b = parseInt(h.slice(4, 6), 16)
  return `${r};${g};${b}`
}

// Render helpers — return RichLog/markup strings
export function paintIcon(icon: IconName, color = COLORS.accent): string {
  return `[bold ${color}]${ICONS[icon]}[/bold ${color}]`
}

export function paintStatus(level: "info" | "ok" | "warn" | "err" | "load", text: string, animFrame = 0): string {
  const palette: Record<string, string> = {
    info: COLORS.info,
    ok: COLORS.success,
    warn: COLORS.warn,
    err: COLORS.error,
    load: COLORS.accent,
  }
  const c = palette[level]
  const icon = level === "load" ? spinnerFrame(animFrame) : ICONS[level === "ok" ? "success" : level === "err" ? "error" : level === "warn" ? "warn" : "info"]
  return `[bold ${c}]${icon}[/bold ${c}]  [${c}]${text}[/${c}]`
}

export function paintSection(title: string, color = COLORS.accent): string {
  const line = "─".repeat(Math.max(8, 60 - title.length - 4))
  return `[bold ${color}]▣ ${title}[/bold ${color}] [${COLORS.tertiary}]${line}[/${COLORS.tertiary}]`
}

export function paintBox(text: string, color = COLORS.accent): string {
  const width = Math.max(40, text.length + 4)
  const top = BOX.topLeft + BOX.horizontal.repeat(width - 2) + BOX.topRight
  const bottom = BOX.bottomLeft + BOX.horizontal.repeat(width - 2) + BOX.bottomRight
  const mid = `${BOX.vertical}[bold ${color}] ${text} [/bold ${color}]${BOX.vertical}`
  return [
    `[${COLORS.accent}]${top}[/${COLORS.accent}]`,
    `[${COLORS.accent}]${mid}[/${COLORS.accent}]`,
    `[${COLORS.accent}]${bottom}[/${COLORS.accent}]`,
  ].join("\n")
}

/** A tasteful NEXUS banner using box-drawing characters. */
export function paintBanner(version: string): string {
  const art = [
    "  ███╗   ██╗███████╗██╗  ██╗██╗   ██╗███████╗",
    "  ████╗  ██║██╔════╝╚██╗██╔╝██║   ██║██╔════╝",
    "  ██╔██╗ ██║█████╗   ╚███╔╝ ██║   ██║███████╗",
    "  ██║╚██╗██║██╔══╝   ██╔██╗ ██║   ██║╚════██║",
    "  ██║ ╚████║███████╗██╔╝ ██╗╚██████╔╝███████║",
    "  ╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝",
  ].join("\n")
  const lines = art.split("\n")
  const gradient = ["#7C3AED", "#9333EA", "#A855F7", "#C084FC", "#D8B4FE", "#E9D5FF"]
  const colored = lines.map((l, i) => `[bold ${gradient[i] ?? "#E9D5FF"}]${l}[/bold ${gradient[i] ?? "#E9D5FF"}]`)
  const subtitle = `[dim ${COLORS.tertiary}]autofarm · v${version} · Agentic API key farmer[/dim ${COLORS.tertiary}]`
  return colored.join("\n") + "\n" + subtitle
}

/** Compact "user typing" prompt with chevron. */
export function paintPrompt(): string {
  return `[bold ${COLORS.accent}]▸[/bold ${COLORS.accent}] `
}

/** A divider with a label in the middle. */
export function paintDivider(label = "", color = COLORS.tertiary): string {
  if (!label) return `[${color}]${"─".repeat(60)}[/${color}]`
  const pad = Math.max(2, 60 - label.length - 2)
  const left = "─".repeat(2)
  const right = "─".repeat(pad)
  return `[${color}]${left} ${label} ${right}[/${color}]`
}

/** Highlight a value in muted color. */
export function paintValue(value: string | number, color = COLORS.accentWarm): string {
  return `[bold ${color}]${value}[/bold ${color}]`
}

/** Highlight a key/label. */
export function paintKey(label: string, color = COLORS.secondary): string {
  return `[${color}]${label}[/${color}]`
}

/** Render a step entry in the chat log with nice icon + colors. */
export function paintStep(
  kind: "info" | "ok" | "warn" | "err" | "load",
  text: string,
  animFrame = 0,
  options: { withBullet?: boolean } = {},
): string {
  return paintStatus(kind, text, animFrame)
}

/** Render a metric line like: "  vault:   7 providers, 5/7 active" */
export function paintMetric(key: string, value: string | number, status: "ok" | "warn" | "err" = "ok"): string {
  const statusColor = status === "ok" ? COLORS.success : status === "warn" ? COLORS.warn : COLORS.error
  return `  [${COLORS.tertiary}]${key.padEnd(14)}[/${COLORS.tertiary}] [bold ${statusColor}]${value}[/bold ${statusColor}]`
}

/** Render the typing indicator ("... is typing") */
export function paintTyping(animFrame = 0): string {
  const dots = ANIM_FRAMES.dots[Math.floor(animFrame / 100) % ANIM_FRAMES.dots.length]
  return `[${COLORS.accent}]${dots}[/${COLORS.accent}] [dim ${COLORS.secondary}]agent is thinking...[/dim ${COLORS.secondary}]`
}
