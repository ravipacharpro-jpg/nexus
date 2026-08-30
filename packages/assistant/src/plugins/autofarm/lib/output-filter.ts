// Output filter: strips code from raw tool output before showing in TUI.
// Used by the autofarm agent loop to keep the chat log clean.
// Mirrors lib/tui.py::filter_code so TS and Python stay in sync.

export interface FilterResult {
  cleaned: string
  droppedLines: number
  reason?: string
}

const CODE_MARKERS = [
  "```",
  "function ", "def ", "class ", "const ", "let ", "var ",
  "import ", "from ", "<?php", "<?xml", "<!DOCTYPE", "<html",
  "SELECT ", "INSERT ", "UPDATE ", "DELETE FROM",
  "{", "};", "</", "/>", "->", "=>",
  "package ", "namespace ", "module.exports",
]

/** Returns a FilterResult with cleaned text and stats. */
export function filterCode(raw: string): FilterResult {
  if (!raw) return { cleaned: "", droppedLines: 0 }
  const lines = raw.split(/\r?\n/)
  const out: string[] = []
  let dropped = 0
  for (const line of lines) {
    if (CODE_MARKERS.some((m) => line.includes(m))) {
      dropped++
      continue
    }
    const stripped = line.trim()
    if (stripped.length > 240 && !/[ .:!?]/.test(stripped)) {
      dropped++
      continue
    }
    out.push(line)
  }
  const cleaned = out.join("\n").trim()
  if (cleaned.length < 3) return { cleaned: "", droppedLines: dropped, reason: "no natural language content" }
  return { cleaned, droppedLines: dropped }
}

/** Convenience: returns just the cleaned string. */
export function filterCodeText(raw: string): string {
  return filterCode(raw).cleaned
}

/** Quick check: is this likely a code block? */
export function looksLikeCode(s: string): boolean {
  if (!s) return false
  return CODE_MARKERS.some((m) => s.includes(m)) || s.split("\n").filter((l) => /^\s*(?:[a-zA-Z_]+\s*\(|import |from |class |function |def )/i.test(l)).length > 2
}

/** Returns a level-appropriate emoji prefix. */
export function statusLine(text: string, level: "info" | "ok" | "warn" | "err" = "info"): string {
  const emoji: Record<string, string> = { info: "⚡", ok: "✓", warn: "!", err: "✗" }
  return `${emoji[level] ?? "•"} ${text}`
}
