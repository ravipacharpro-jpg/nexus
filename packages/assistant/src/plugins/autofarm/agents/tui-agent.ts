// tui-agent: TypeScript bridge for the Python Textual TUI.
// Exposes an async agent loop that talks to the autofarm subsystem
// and produces status updates suitable for a chat-style display.
//
// Architecture:
//   Python TUI (lib/tui.py)
//        ↕ JSON-RPC over stdio (when NEXUS_AUTOFARM_SOCKET is set)
//   This module (tui-agent.ts)
//        ↕ direct function calls
//   autofarm agents (gmail/provider/monitor/etc.)

import { log } from "../lib/logger.ts"
import { filterCode, statusLine } from "../lib/output-filter.ts"
import { snapshot as monitorSnapshot } from "./monitor-agent.ts"
import { runCycle, decidePublic } from "./orchestrator.ts"
import { vaultSummary } from "../lib/vault.ts"
import { decide as dsDecide, snapshotSupply, snapshotDemand } from "../lib/demand-supply.ts"
import { taskQueue } from "../lib/queue.ts"
import { paintStatus, paintSection, paintMetric, paintDivider, ICONS, COLORS } from "../lib/ui-icons.ts"

export interface AgentStep {
  text: string
  level: "info" | "ok" | "warn" | "err"
  ts: number
}

export interface AgentResult {
  steps: AgentStep[]
  ok: boolean
  error?: string
  ms: number
}

function step(text: string, level: AgentStep["level"] = "info"): AgentStep {
  return { text: statusLine(text, level), level, ts: Date.now() }
}

async function pause(ms: number) {
  await new Promise((r) => setTimeout(r, ms))
}

/** Build a status snapshot for the TUI's "status" shortcut. */
export function statusSnapshot(): AgentStep[] {
  const mon = monitorSnapshot()
  const v = vaultSummary()
  const dec = decidePublic()
  const sup = snapshotSupply()
  const dem = snapshotDemand()
  return [
    step(`bridge:    tui-agent (autofarm v0.2.2)`, "info"),
    step(`vault:     ${v.providers} providers, ${v.activeKeys}/${v.totalKeys} active keys`, "info"),
    step(`supply:    ${sup.totalActive} keys, ${(sup.ratio * 100).toFixed(0)}% of daily budget used`, "info"),
    step(`demand:    ${dem.models.length} models tracked, hotness ${(dem.hotness * 100).toFixed(0)}%`, "info"),
    step(`decision:  ${dec.status} → ${dec.action}`, "info"),
    step(`load:      ${mon.load.loadLevel} (cpu ${mon.load.cpu.toFixed(2)})`, "info"),
    step(`predictions: ${mon.predictions.length} providers`, "info"),
  ]
}

/** Run a generic agent task and return step-by-step progress. */
export async function runAgentTask(task: string): Promise<AgentResult> {
  const t0 = Date.now()
  const steps: AgentStep[] = []
  try {
    const text = task.trim()
    const lower = text.toLowerCase()

    // Shortcuts
    if (lower === "status" || lower === "health") {
      steps.push(...statusSnapshot())
      steps.push(step("status complete", "ok"))
      return { steps, ok: true, ms: Date.now() - t0 }
    }
    if (lower === "discover" || lower.startsWith("discover")) {
      steps.push(step("deciding whether to discover", "info"))
      const d = dsDecide()
      steps.push(step(`decision: ${d.status} → ${d.recommendation}`, "info"))
      if (d.recommendation !== "discover" && d.recommendation !== "urgent-farm") {
        steps.push(step("not time to discover (low hotness or surplus)", "warn"))
        return { steps, ok: true, ms: Date.now() - t0 }
      }
      steps.push(step("searching HackerNews, GitHub, DuckDuckGo…", "info"))
      const { discoverAll } = await import("../lib/discovery.ts")
      const found = await discoverAll()
      steps.push(step(`discovered ${found.length} candidates`, "info"))
      if (found.length > 0) {
        steps.push(step("validating top candidates…", "info"))
        for (const c of found.slice(0, 5)) {
          steps.push(step(`[${c.source}] ${c.title.slice(0, 50)}…`, "info"))
          await pause(50)
        }
      }
      steps.push(step("discovery complete", "ok"))
      return { steps, ok: true, ms: Date.now() - t0 }
    }
    if (lower.startsWith("farm") || lower.startsWith("create-gmail") || lower === "cycle") {
      steps.push(step("checking system load", "info"))
      const mon = monitorSnapshot()
      if (mon.load.loadLevel === "high") {
        steps.push(step(`load is ${mon.load.loadLevel} — resting`, "warn"))
        return { steps, ok: true, ms: Date.now() - t0 }
      }
      steps.push(step("running one orchestrator cycle", "info"))
      const cycle = await runCycle()
      steps.push(step(`cycle: ${cycle.status} → ${cycle.action}`, cycle.status === "critical" ? "err" : "info"))
      if (typeof cycle.discovered === "number") steps.push(step(`discovered: ${cycle.discovered} candidates`, "info"))
      if (typeof cycle.validated === "number") steps.push(step(`validated: ${cycle.validated}`, "info"))
      if (cycle.newGmails > 0) steps.push(step(`created ${cycle.newGmails} Gmail(s)`, "ok"))
      if (cycle.newKeys > 0) steps.push(step(`farmed ${cycle.newKeys} new API key(s)`, "ok"))
      if (cycle.fixed > 0) steps.push(step(`fixer applied ${cycle.fixed} remediation(s)`, "ok"))
      steps.push(step("cycle complete", cycle.newKeys > 0 ? "ok" : "info"))
      return { steps, ok: true, ms: Date.now() - t0 }
    }
    if (lower.startsWith("queue")) {
      const s = taskQueue.status()
      steps.push(step(`queue: ${s.pending} pending, ${s.done} done, ${s.failed} failed`, "info"))
      return { steps, ok: true, ms: Date.now() - t0 }
    }
    if (lower === "reticle" || lower.startsWith("reticle ")) {
      const { isReticleInstalled, readReticleStatus } = await import("../lib/reticle.ts")
      const installed = await isReticleInstalled()
      const s = readReticleStatus()
      steps.push(step(`reticle installed: ${installed ? "yes" : "no"}`, installed ? "ok" : "warn"))
      steps.push(step(`daemon: ${s.daemonRunning ? "running" : "stopped"}`, "info"))
      steps.push(step(`connected: ${s.connected ? "yes" : "no"}`, "info"))
      return { steps, ok: true, ms: Date.now() - t0 }
    }

    // Fallback: try to interpret as a free-form task via the LLM brain.
    steps.push(step(`interpreting: "${task.slice(0, 60)}…"`, "info"))
    try {
      const { runBrain } = await import("./llm-brain.ts")
      const decision = await runBrain()
      steps.push(step(`brain → ${decision.action} (urgency ${decision.urgency}/5)`, "info"))
      steps.push(step(`reason: ${decision.reason}`, "info"))
      for (const t of decision.tasks.slice(0, 3)) {
        steps.push(step(`task: ${t.task} → ${t.preferredProvider} (${t.reason.slice(0, 40)}…)`, "info"))
      }
    } catch {
      steps.push(step("no brain key available; defaulting to monitor", "warn"))
    }
    steps.push(step("task interpretation complete", "ok"))
    return { steps, ok: true, ms: Date.now() - t0 }
  } catch (e) {
    log.error("tui-agent", `task failed: ${(e as Error).message}`)
    return { steps, ok: false, error: (e as Error).message, ms: Date.now() - t0 }
  }
}

/** Format steps as human-friendly chat lines (no code). */
export function formatStepsForChat(steps: AgentStep[]): string[] {
  return steps.map((s) => s.text)
}
