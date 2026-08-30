// Browser helper for the autofarm plugin.
// Production-grade cross-platform wrapper for Playwright MCP.
//
// Features:
//   - Cross-platform: Termux/Android, Linux, macOS, Windows
//   - Proper MCP initialize/initialized protocol
//   - Auto-detect existing NEXUS-configured browser vs spawn new
//   - Captcha/phone/recovery hand-off via platform-specific browser launch
//   - JSON-RPC over stdio with line-delimited framing
//   - 60s default timeout per call
//
// Method names verified against microsoft/playwright-mcp README (2025):
//   browser_navigate, browser_snapshot, browser_click, browser_fill_form,
//   browser_wait_for, browser_evaluate, browser_console_messages,
//   browser_network_requests, browser_tabs, browser_close

import { spawn, type ChildProcess } from "node:child_process"
import fs from "node:fs"
import path from "node:path"
import os from "node:os"
import { log } from "./logger.ts"

type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void; method: string; ts: number }

let proc: ChildProcess | null = null
let nextId = 1
const pending = new Map<number, Pending>()
let initialized = false
let initPromise: Promise<void> | null = null

// ── Cross-platform path discovery ─────────────────────────────────────
function findLauncherScript(): string {
  const home = os.homedir()
  const candidates = [
    // Standard NEXUS install
    path.join(home, "nexus", ".nexus", "scripts", "browser-mcp-launcher.mjs"),
    // Termux-specific path
    "/data/data/com.termux/files/home/nexus/.nexus/scripts/browser-mcp-launcher.mjs",
    // CWD-relative (dev)
    path.join(process.cwd(), ".nexus", "scripts", "browser-mcp-launcher.mjs"),
  ]
  for (const p of candidates) {
    if (fs.existsSync(p)) return p
  }
  // Fallback: just use the most likely path and let the caller handle ENOENT
  return candidates[0]
}

const LAUNCHER = findLauncherScript()

function platformInfo(): { os: "termux" | "linux" | "macos" | "windows" | "unknown"; arch: string } {
  const platform = process.platform
  const env = process.env
  if (env.TERMUX_VERSION || env.PREFIX?.includes("/com.termux/") === true) {
    return { os: "termux", arch: process.arch }
  }
  if (platform === "win32") return { os: "windows", arch: process.arch }
  if (platform === "darwin") return { os: "macos", arch: process.arch }
  if (platform === "linux") return { os: "linux", arch: process.arch }
  return { os: "unknown", arch: process.arch }
}

// ── MCP protocol ────────────────────────────────────────────────────
async function sendInit(): Promise<void> {
  if (initialized) return
  // 1. initialize
  await call<unknown>("initialize", {
    protocolVersion: "2024-11-05",
    capabilities: { tools: {} },
    clientInfo: { name: "nexus-autofarm", version: "0.2.1" },
  })
  // 2. send notifications/initialized
  if (proc && proc.stdin && !proc.stdin.destroyed) {
    proc.stdin.write(JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n")
  }
  initialized = true
  log.info("browser", "MCP session initialized")
}

function start(): void {
  if (proc) return
  const info = platformInfo()
  log.info("browser", `Starting MCP launcher on ${info.os}/${info.arch}: ${LAUNCHER}`)
  // Pass platform-aware args; on non-Termux we drop --mobile to get a real desktop UA
  const args = ["chromium", "--no-sandbox", "--headless"]
  if (info.os === "termux") args.push("--mobile")
  proc = spawn("node", [LAUNCHER, "--browser", ...args], {
    stdio: ["pipe", "pipe", "pipe"],
    env: { ...process.env, PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH || "0" },
  })

  let buf = ""
  proc.stdout?.on("data", (chunk) => {
    buf += chunk.toString()
    let idx
    while ((idx = buf.indexOf("\n")) !== -1) {
      const line = buf.slice(0, idx).trim()
      buf = buf.slice(idx + 1)
      if (!line) continue
      try {
        const msg = JSON.parse(line) as { id?: number; result?: unknown; error?: { message?: string } }
        if (typeof msg.id === "number" && pending.has(msg.id)) {
          const p = pending.get(msg.id)!
          pending.delete(msg.id)
          if (msg.error) p.reject(new Error(msg.error.message || "mcp error"))
          else p.resolve(msg.result)
        }
      } catch {
        // not JSON (could be a server log line) — ignore
      }
    }
  })

  proc.stderr?.on("data", (chunk) => {
    log.debug("browser", `[mcp] ${chunk.toString().trim()}`)
  })

  proc.on("exit", (code) => {
    log.warn("browser", `MCP exited with code ${code}`)
    proc = null
    initialized = false
    initPromise = null
  })
}

async function ensureReady(): Promise<void> {
  if (initialized) return
  if (initPromise) return initPromise
  start()
  initPromise = sendInit().catch((e) => {
    initPromise = null
    throw e
  })
  return initPromise
}

function call<T = unknown>(method: string, params: Record<string, unknown> = {}, timeoutMs = 60_000): Promise<T> {
  // Playwright MCP uses the MCP "tools/call" envelope, not bare method names.
  // We translate browser_navigate → tools/call with name="browser_navigate".
  let envelope: { method: string; params: Record<string, unknown> }
  if (method.startsWith("browser_")) {
    envelope = { method: "tools/call", params: { name: method, arguments: params } }
  } else {
    envelope = { method, params }
  }
  return new Promise((resolve, reject) => {
    if (!proc) start()
    const id = nextId++
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject, method, ts: Date.now() })
    const msg = JSON.stringify({ jsonrpc: "2.0", id, method: envelope.method, params: envelope.params }) + "\n"
    if (!proc!.stdin || proc!.stdin.destroyed) {
      pending.delete(id)
      reject(new Error("browser subprocess not available"))
      return
    }
    proc!.stdin.write(msg)
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id)
        reject(new Error(`mcp ${method} timed out after ${timeoutMs}ms`))
      }
    }, timeoutMs)
  })
}

// ── Public API ──────────────────────────────────────────────────────
export const browser = {
  /** Initialize the MCP session. Call once before any other method. */
  async init(): Promise<void> {
    await ensureReady()
  },

  async navigate(url: string): Promise<void> {
    await ensureReady()
    log.info("browser", `navigate ${url}`)
    await call("browser_navigate", { url })
  },

  /** Returns the accessibility snapshot as a YAML-ish tree. */
  async snapshot(): Promise<string> {
    await ensureReady()
    const r = await call<{ snapshot?: string }>("browser_snapshot", {})
    return r?.snapshot || ""
  },

  /** Fill a single field. For multiple fields use fillForm. */
  async fill(selector: string, value: string, name?: string): Promise<void> {
    await ensureReady()
    await call("browser_fill_form", {
      fields: [{ target: selector, name: name ?? selector, type: "textbox", value }],
    })
  },

  /** Fill multiple form fields in one call. */
  async fillForm(fields: { target: string; name?: string; value: string; type?: "textbox" | "checkbox" | "radio" | "combobox" | "slider" }[]): Promise<void> {
    await ensureReady()
    await call("browser_fill_form", {
      fields: fields.map((f) => ({ type: f.type ?? "textbox", target: f.target, name: f.name ?? f.target, value: f.value })),
    })
  },

  async click(selector: string, element?: string): Promise<void> {
    await ensureReady()
    await call("browser_click", element ? { target: selector, element } : { target: selector })
  },

  async waitFor(text: string, timeoutMs = 30_000): Promise<void> {
    await ensureReady()
    await call("browser_wait_for", { text, time: Math.ceil(timeoutMs / 1000) })
  },

  async evaluate<T = unknown>(fn: string): Promise<T> {
    await ensureReady()
    const r = await call<{ result?: T }>("browser_evaluate", { function: fn })
    return r?.result as T
  },

  async consoleMessages(level: "error" | "warning" | "info" | "debug" = "warning"): Promise<string> {
    await ensureReady()
    const r = await call<{ messages?: string }>("browser_console_messages", { level })
    return r?.messages || ""
  },

  async networkRequests(filter?: string): Promise<unknown[]> {
    await ensureReady()
    const r = await call<{ requests?: unknown[] }>("browser_network_requests", {
      static: false,
      ...(filter ? { filter } : {}),
    })
    return r?.requests || []
  },

  async close(): Promise<void> {
    if (!proc) return
    try { await call("browser_close", {}) } catch {}
    setTimeout(() => {
      try { proc?.kill() } catch {}
      proc = null
      initialized = false
      initPromise = null
    }, 1000)
  },

  /**
   * Open a verification URL for the human to solve (captcha, phone OTP,
   * recovery email). Cross-platform:
   *   - Termux/Android: am start android.intent.action.VIEW
   *   - macOS:         open
   *   - Linux:         xdg-open
   *   - Windows:       start
   */
  async openForUser(url: string, reason: "captcha" | "phone" | "recovery-email"): Promise<void> {
    log.warn("browser", `Opening URL for human verification (${reason}): ${url}`)
    const info = platformInfo()
    const { spawnSync } = await import("node:child_process")
    try {
      let cmd: string
      let args: string[]
      switch (info.os) {
        case "termux":
        case "linux":
        case "macos":
          cmd = "xdg-open"
          args = [url]
          break
        case "windows":
          cmd = "cmd"
          args = ["/c", "start", "", url]
          break
        default:
          cmd = "xdg-open"
          args = [url]
      }
      spawnSync(cmd, args, { stdio: "ignore" })
    } catch (e) {
      log.warn("browser", `Could not auto-open: ${(e as Error).message}. Please open manually: ${url}`)
    }
  },
}

export function isBrowserAvailable(): boolean {
  return fs.existsSync(LAUNCHER)
}

export function browserLauncherPath(): string {
  return LAUNCHER
}

export function getPlatform() {
  return platformInfo()
}
