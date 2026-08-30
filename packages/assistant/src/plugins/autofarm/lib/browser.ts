// Browser helper for the autofarm plugin.
// Wraps the Playwright MCP server that is already integrated with NEXUS.
// We talk to it via stdio JSON-RPC like MCP does.

import { spawn, type ChildProcess } from "node:child_process"
import path from "node:path"
import os from "node:os"
import { log } from "./logger.ts"

type Pending = { resolve: (v: unknown) => void; reject: (e: Error) => void }

let proc: ChildProcess | null = null
let nextId = 1
const pending = new Map<number, Pending>()

const LAUNCHER = path.join(os.homedir(), "nexus", ".nexus", "scripts", "browser-mcp-launcher.mjs")

function start(): void {
  if (proc) return
  log.info("browser", `Starting MCP launcher: ${LAUNCHER}`)
  proc = spawn("node", [LAUNCHER, "--browser", "chromium", "--no-sandbox", "--headless", "--mobile", "--warmup"], {
    stdio: ["pipe", "pipe", "pipe"],
    env: process.env,
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
        const msg = JSON.parse(line)
        if (typeof msg.id === "number" && pending.has(msg.id)) {
          const p = pending.get(msg.id)!
          pending.delete(msg.id)
          if (msg.error) p.reject(new Error(msg.error.message || "mcp error"))
          else p.resolve(msg.result)
        }
      } catch {
        // not JSON, ignore (log lines)
      }
    }
  })

  proc.stderr?.on("data", (chunk) => {
    log.debug("browser", `[mcp] ${chunk.toString().trim()}`)
  })

  proc.on("exit", (code) => {
    log.warn("browser", `MCP exited with code ${code}`)
    proc = null
  })
}

function call<T = unknown>(method: string, params: Record<string, unknown> = {}): Promise<T> {
  return new Promise((resolve, reject) => {
    if (!proc) start()
    const id = nextId++
    pending.set(id, { resolve: resolve as (v: unknown) => void, reject })
    const msg = JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n"
    proc!.stdin?.write(msg)
    setTimeout(() => {
      if (pending.has(id)) {
        pending.delete(id)
        reject(new Error(`mcp ${method} timed out`))
      }
    }, 60_000)
  })
}

export const browser = {
  async navigate(url: string): Promise<void> {
    log.info("browser", `navigate ${url}`)
    await call("browser_navigate", { url })
  },
  async snapshot(): Promise<string> {
    const r = await call<{ snapshot?: string }>("browser_snapshot", {})
    return r?.snapshot || ""
  },
  async fill(selector: string, value: string): Promise<void> {
    await call("browser_fill_form", { fields: [{ target: selector, name: selector, type: "textbox", value }] })
  },
  async click(selector: string): Promise<void> {
    await call("browser_click", { target: selector })
  },
  async waitFor(text: string, timeoutMs = 30_000): Promise<void> {
    await call("browser_wait_for", { text, time: Math.ceil(timeoutMs / 1000) })
  },
  async evaluate<T = unknown>(fn: string): Promise<T> {
    const r = await call<{ result?: T }>("browser_evaluate", { function: fn })
    return (r as { result?: T })?.result as T
  },
  async close(): Promise<void> {
    if (!proc) return
    proc.kill()
    proc = null
  },
  /**
   * Open a verification page in front of the user and wait until they mark it done.
   * The browser MCP does not expose a native "open in user-facing browser" call,
   * so we fall back to launching the system browser with `am start` on Android/Termux.
   */
  async openForUser(url: string, reason: "captcha" | "phone" | "recovery-email"): Promise<void> {
    log.warn("browser", `Opening URL for human verification (${reason}): ${url}`)
    try {
      // Best effort: try to launch the system browser.
      const { spawnSync } = await import("node:child_process")
      spawnSync("am", ["start", "-a", "android.intent.action.VIEW", "-d", url], { stdio: "ignore" })
    } catch (e) {
      log.warn("browser", `Could not auto-open: ${(e as Error).message}. Please open manually: ${url}`)
    }
  },
}