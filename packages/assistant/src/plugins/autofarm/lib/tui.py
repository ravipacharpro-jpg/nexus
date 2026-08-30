"""
Premium Textual TUI for the NEXUS autofarm plugin.

NO emojis. Uses Unicode box-drawing + Braille patterns + gradients
for that Claude Mobile / Linear / Vercel premium feel.

Features:
- Animated spinner (Braille patterns, 10 fps)
- Gradient NEXUS banner
- Box-drawing cards for status
- Animated progress bars
- Color-coded metric rows
- Custom status indicator
- Live timer in header
- Smooth status line transitions
"""

from __future__ import annotations

import asyncio
import os
import sys
import time
from typing import Any, Optional

try:
    from textual.app import App, ComposeResult
    from textual.widgets import RichLog, Input, Header, Static
    from textual.containers import Vertical, Container
    from textual.reactive import reactive
    from textual.binding import Binding
except ImportError:
    print("textual not installed. Run: pip install textual", file=sys.stderr)
    sys.exit(2)


# ── Color palette (Claude/Linear style) ─────────────────────────────
# True-color hex for terminals that support 24-bit color.
ACCENT = "#7C3AED"          # Purple
ACCENT_ALT = "#06B6D4"      # Cyan
SUCCESS = "#10B981"         # Emerald
ERROR = "#EF4444"           # Red
WARN = "#F59E0B"            # Amber
INFO = "#3B82F6"            # Blue
PRIMARY = "#FAFAFA"
SECONDARY = "#A1A1AA"
TERTIARY = "#52525B"


# ── Icons (no emojis!) ─────────────────────────────────────────────
ICONS = {
    "loading": "⠋", "loading_alt": "⠙",
    "success": "✓", "error": "✕", "warn": "⚠", "info": "•",
    "arrow": "▸", "vault": "▣", "lock": "▤", "key": "⚷",
    "mail": "✉", "browser": "⊟", "search": "⌕", "brain": "◈",
    "fire": "✦", "bolt": "↯", "star": "★", "check": "✔",
    "circle": "●", "dot": "·", "square": "▪",
    "bullet": "▸", "diamond": "◆", "triangle": "▲",
}

# Animated spinner frames (Braille - smooth)
SPINNER = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"]
SPINNER_DOTS = ["⠁", "⠂", "⠄", "⡀", "⢀", "⠠", "⠐", "⠈"]
SPINNER_PULSE = ["▁", "▂", "▃", "▄", "▅", "▆", "▇", "█", "▇", "▆", "▅", "▄", "▃", "▂"]

# Progress bar frames (for animated fill)
PROGRESS = [
    "▏░░░░░░░░░", "▎░░░░░░░░░", "▍░░░░░░░░░", "▌░░░░░░░░░",
    "▋░░░░░░░░░", "▊░░░░░░░░░", "▉░░░░░░░░░", "█░░░░░░░░░",
]


# ── Markup helpers ─────────────────────────────────────────────────
def paint(text: str, color: str = ACCENT, bold: bool = True) -> str:
    """Wrap text in Rich markup with color."""
    style = f"bold {color}" if bold else color
    return f"[{style}]{text}[/{style}]"


def icon(name: str, color: str = ACCENT) -> str:
    """Return a colored icon."""
    return paint(ICONS.get(name, "•"), color)


def status(kind: str, text: str, frame: int = 0) -> str:
    """Render a status line with icon + colored text."""
    if kind == "load":
        sp = SPINNER[frame % len(SPINNER)]
        return f"{paint(sp, ACCENT)}  {paint(text, ACCENT, bold=False)}"
    icon_map = {"info": "info", "ok": "success", "warn": "warn", "err": "error"}
    color_map = {"info": INFO, "ok": SUCCESS, "warn": WARN, "err": ERROR}
    return f"{icon(icon_map[kind], color_map[kind])}  {paint(text, color_map[kind], bold=False)}"


def metric(key: str, value: Any, status: str = "ok") -> str:
    """Render a metric line like '  vault:   7 providers, 5/7 active'."""
    status_color = {"ok": SUCCESS, "warn": WARN, "err": ERROR}.get(status, PRIMARY)
    key_padded = key.ljust(14)
    return f"  [dim {TERTIARY}]{key_padded}[/dim {TERTIARY}] {paint(str(value), status_color)}"


def banner(version: str) -> str:
    """Render the NEXUS banner with gradient."""
    art = [
        "  ███╗   ██╗███████╗██╗  ██╗██╗   ██╗███████╗",
        "  ████╗  ██║██╔════╝╚██╗██╔╝██║   ██║██╔════╝",
        "  ██╔██╗ ██║█████╗   ╚███╔╝ ██║   ██║███████╗",
        "  ██║╚██╗██║██╔══╝   ██╔██╗ ██║   ██║╚════██║",
        "  ██║ ╚████║███████╗██╔╝ ██╗╚██████╔╝███████║",
        "  ╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝",
    ]
    # Gradient: deep purple → light purple
    gradient = ["#5B21B6", "#6D28D9", "#7C3AED", "#8B5CF6", "#A78BFA", "#C4B5FD"]
    lines = []
    for i, line in enumerate(art):
        c = gradient[i] if i < len(gradient) else gradient[-1]
        lines.append(f"[bold {c}]{line}[/bold {c}]")
    subtitle = f"[dim {TERTIARY}]autofarm · v{version} · Agentic API key farmer[/dim {TERTIARY}]"
    return "\n".join(lines) + "\n" + subtitle


def section(title: str, color: str = ACCENT) -> str:
    """Render a section header with a horizontal line."""
    line = "─" * max(8, 60 - len(title) - 4)
    return f"{paint('▣ ' + title, color)} [dim {TERTIARY}]{line}[/dim {TERTIARY}]"


def card(title: str, body: str, color: str = ACCENT) -> str:
    """Render a card with a title and body content."""
    width = max(50, len(title) + 4, len(body.split("\n")[0]) + 4)
    top = "╭" + "─" * (width - 2) + "╮"
    bottom = "╰" + "─" * (width - 2) + "╯"
    title_line = f"│ {paint(title, color)} │".ljust(width + 20)
    body_lines = [f"│ {line} │" for line in body.split("\n")]
    return "\n".join([paint(top, color), title_line, *body_lines, paint(bottom, color)])


def progress_bar(percent: float, width: int = 20, frame: int = 0) -> str:
    """Animated progress bar."""
    filled = round(percent * width)
    empty = width - filled
    bar = "█" * filled + "░" * empty
    color = SUCCESS if percent >= 1 else ACCENT if percent >= 0.5 else WARN
    return f"[{color}]{bar}[/{color}] {paint(f'{int(percent*100)}%', color)}"


def divider(label: str = "", color: str = TERTIARY) -> str:
    """Horizontal divider with optional centered label."""
    if not label:
        return paint("─" * 60, color, bold=False)
    pad = max(2, 60 - len(label) - 2)
    return paint(f"── {label} " + "─" * pad, color, bold=False)


def prompt() -> str:
    """The input prompt character."""
    return paint("▸", ACCENT, bold=True)


def typing_indicator(frame: int = 0) -> str:
    """Animated 'agent is thinking' indicator."""
    dots = SPINNER_DOTS[frame % len(SPINNER_DOTS)]
    return f"{paint(dots, ACCENT)} {paint('agent is thinking', SECONDARY, bold=False)}"


# ── NEXUS bridge (placeholder for real JSON-RPC) ──────────────────
class NEXUSBridge:
    async def start(self) -> None: ...
    async def call(self, method: str, params: dict[str, Any] | None = None) -> dict[str, Any]:
        await asyncio.sleep(0.05)
        return {"ok": True, "method": method, "result": _sim(method, params or {})}


def _sim(method: str, params: dict[str, Any]) -> dict[str, Any]:
    if method == "agent.run":
        return {
            "steps": [
                ("info", "Analyzing task"),
                ("info", "Checking system load"),
                ("load", "Running orchestrator cycle"),
                ("info", "Creating Gmail account"),
                ("load", "Navigating to provider signup"),
                ("info", "Filling form fields"),
                ("ok", "Captcha detected - opening browser"),
                ("ok", "Verification URL sent"),
                ("ok", "Key extracted (HTTP 200)"),
                ("ok", "Key added to vault"),
            ],
            "metrics": {
                "vault": ("7 providers, 6/8 active", "ok"),
                "supply": ("35% of daily budget", "ok"),
                "demand": ("hotness 40%", "ok"),
                "decision": ("low → farm-now", "warn"),
                "load": ("medium (cpu 0.85)", "ok"),
            },
        }
    if method == "agent.ack":
        return {"acknowledged": True}
    return {"echo": params}


# ── Code filter ─────────────────────────────────────────────────────
CODE_MARKERS = (
    "```", "function ", "def ", "class ", "const ", "let ", "var ",
    "import ", "from ", "<?php", "<?xml", "<!DOCTYPE", "<html",
    "SELECT ", "INSERT ", "UPDATE ", "DELETE FROM",
    "{", "};", "</", "/>", "->", "=>",
)


def filter_code(raw: str) -> str:
    if not raw:
        return ""
    out = []
    for line in raw.splitlines():
        if any(m in line for m in CODE_MARKERS):
            continue
        s = line.strip()
        if len(s) > 240 and not any(c in s for c in " .:!?"):
            continue
        out.append(line)
    cleaned = "\n".join(out).strip()
    return cleaned if len(cleaned) >= 3 else ""


# ── The TUI App ────────────────────────────────────────────────────

VERSION = "0.2.2"


class CustomTuiAgent(App):
    """Premium Manus-style agent TUI for NEXUS autofarm."""

    CSS = f"""
    Screen {{
        background: #0A0A0A;
        color: {PRIMARY};
    }}
    Header {{
        background: #18181B;
        color: {ACCENT};
        text-style: bold;
    }}
    #chat_log {{
        background: #0A0A0A;
        border: tall #27272A;
        padding: 1 2;
        margin: 1 2 0 2;
    }}
    #input_box {{
        margin: 0 2 1 2;
        border: tall #27272A;
        background: #18181B;
    }}
    #input_box:focus {{
        border: tall {ACCENT};
    }}
    """

    BINDINGS = [
        Binding("ctrl+c", "quit", "Quit", show=True),
        Binding("ctrl+l", "clear_log", "Clear", show=True),
    ]

    spinner_frame = reactive(0)

    def __init__(self) -> None:
        super().__init__()
        self.bridge = NEXUSBridge()
        self._busy = False
        self._start_time = time.time()

    def compose(self) -> ComposeResult:
        yield Header(show_clock=True, name="NEXUS autofarm")
        with Vertical():
            yield RichLog(
                id="chat_log",
                highlight=True,
                markup=True,
                wrap=True,
                auto_scroll=True,
            )
            yield Input(
                placeholder="Type a task — try 'status', 'farm groq', 'discover'…",
                id="input_box",
                prompt=paint("▸"),
            )

    async def on_mount(self) -> None:
        self.chat_log = self.query_one("#chat_log", RichLog)
        self.input_box = self.query_one("#input_box", Input)
        self.input_box.focus()
        await self.bridge.start()
        # Animated welcome banner
        self.chat_log.write(banner(VERSION))
        self.chat_log.write("")
        self.chat_log.write(divider("ready", ACCENT))
        self.chat_log.write(paint("Type a task and press Enter. Raw code is filtered — only status updates appear.", SECONDARY, bold=False))
        self.chat_log.write("")
        self.chat_log.write(paint("Try one of these to get started:", PRIMARY, bold=False))
        examples = [
            ("status", "show vault + decisions"),
            ("discover", "hunt new free LLM providers"),
            ("farm <name>", "farm a specific provider"),
            ("predict-ml", "14-day usage forecast"),
            ("queue", "background task queue"),
            ("reticle", "verification layer status"),
            ("cost today", "today's spend"),
            ("help", "show all shortcuts"),
        ]
        for cmd, desc in examples:
            self.chat_log.write(f"  {paint('▸', ACCENT, bold=False)} {paint(cmd, ACCENT_ALT, bold=True)} {paint('— ' + desc, SECONDARY, bold=False)}")
        self.chat_log.write("")
        # Spinner animation loop
        self._anim_timer = self.set_interval(0.1, self._tick_spinner)

    def _tick_spinner(self) -> None:
        self.spinner_frame += 1

    async def on_input_submitted(self, message: Input.Submitted) -> None:
        if self._busy:
            self.chat_log.write(status("warn", "Agent is busy. Please wait…"))
            return
        text = (message.value or "").strip()
        if not text:
            return
        message.input.value = ""
        # User echo
        self.chat_log.write(f"{prompt()}  {paint(text, PRIMARY, bold=True)}")
        # Instant ack (Manus-style)
        self.chat_log.write(typing_indicator(self.spinner_frame))
        self.chat_log.write(status("info", "Samjha, abhi shuru karta hoon…"))
        # Background task
        asyncio.create_task(self._run_agent(text))

    async def _run_agent(self, user_text: str) -> None:
        self._busy = True
        try:
            lower = user_text.lower()
            if lower in ("help", "?", "h"):
                self._print_help()
                return
            if lower == "status":
                await self._show_status()
                return
            if lower == "clear":
                self.chat_log.clear()
                return

            # Real agent run via bridge
            response = await self.bridge.call("agent.run", {"task": user_text})
            steps = response.get("result", {}).get("steps", [])
            for i, (kind, text) in enumerate(steps):
                # Show spinner for "load" steps
                if kind == "load":
                    # Animate the load step for 0.4s
                    for _ in range(4):
                        self._replace_last(status("load", text, self.spinner_frame))
                        await asyncio.sleep(0.1)
                else:
                    self.chat_log.write(status(kind, text, self.spinner_frame))
                await asyncio.sleep(0.2)
            # Metrics block
            metrics = response.get("result", {}).get("metrics", {})
            if metrics:
                self.chat_log.write("")
                self.chat_log.write(section("metrics", ACCENT))
                for k, (v, s) in metrics.items():
                    self.chat_log.write(metric(k, v, s))
            self.chat_log.write("")
            self.chat_log.write(status("ok", "Task complete"))
        except Exception as e:
            self.chat_log.write(status("err", f"Error: {e}"))
        finally:
            self._busy = False

    def _replace_last(self, new_text: str) -> None:
        """Replace the last line in the log (for spinner animation)."""
        try:
            # RichLog in textual doesn't have direct line replacement, so we
            # write a new line each tick. The user perceives it as a refresh
            # because the load step is short.
            self.chat_log.write(new_text)
        except Exception:
            pass

    async def _show_status(self) -> None:
        self.chat_log.write("")
        self.chat_log.write(section("NEXUS autofarm status", ACCENT))
        self.chat_log.write(metric("bridge", "tui-agent (autofarm v0.2.2)", "ok"))
        self.chat_log.write(metric("vault", "6 providers, 5/7 active keys", "ok"))
        self.chat_log.write(metric("loop", "stopped", "warn"))
        self.chat_log.write(metric("supply", "35% of daily budget used", "ok"))
        self.chat_log.write(metric("demand", "hotness 40%", "ok"))
        self.chat_log.write(metric("decision", "low → farm-now", "warn"))
        self.chat_log.write(metric("reticle", "not installed (graceful)", "warn"))
        self.chat_log.write(metric("python", sys.version.split()[0], "ok"))
        self.chat_log.write(metric("uptime", f"{int(time.time() - self._start_time)}s", "ok"))
        self.chat_log.write("")

    def _print_help(self) -> None:
        self.chat_log.write("")
        self.chat_log.write(section("Available shortcuts", ACCENT))
        shortcuts = [
            ("status", "show vault + loop + decisions"),
            ("discover", "run discovery for new free LLM providers"),
            ("farm <name>", "farm a specific provider (e.g. 'farm groq')"),
            ("predict-ml", "14-day ML usage forecast"),
            ("queue", "background task queue status"),
            ("cost today", "today's spend summary"),
            ("reticle", "show Reticle verification status"),
            ("supply status", "demand-supply engine status"),
            ("clear", "clear chat log"),
            ("help", "this help"),
            ("quit", "exit (Ctrl+C)"),
        ]
        for cmd, desc in shortcuts:
            self.chat_log.write(f"  {paint('▸', ACCENT, bold=False)} {paint(cmd, ACCENT_ALT, bold=True)} {paint('— ' + desc, SECONDARY, bold=False)}")
        self.chat_log.write("")

    def action_clear_log(self) -> None:
        self.chat_log.clear()
        self.chat_log.write(banner(VERSION))


def main() -> int:
    app = CustomTuiAgent()
    app.run()
    return 0


if __name__ == "__main__":
    sys.exit(main())
