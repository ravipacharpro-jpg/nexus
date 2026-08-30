// Orchestrator: the brain that decides when to farm, when to rest,
// and when to call the fixer agent. Demand-supply based.

import { log } from "../lib/logger.ts"
import { snapshot, loadLevel, predictExhaustion } from "./monitor-agent.ts"
import { record } from "./demand-agent.ts"
import { createMany, listAccounts, pendingVerify } from "./gmail-agent.ts"
import { farmForGmail } from "./provider-agent.ts"
import { runFixers } from "./fixer-agent.ts"
import { vaultSummary } from "../lib/vault.ts"
import type { FarmStatus } from "../lib/types.ts"

let loopHandle: ReturnType<typeof setInterval> | null = null
let running = false

function decide(): { status: FarmStatus; action: string; gap: number; ratio: number } {
  const s = snapshot()
  const load = s.load
  const sup = vaultSummary()
  // Sum daily limit of all configured providers (rough upper bound).
  const dailyBudget = 5_000_000
  const used = s.supply.reduce((a, b) => a + b.usedToday, 0)
  const ratio = dailyBudget ? used / dailyBudget : 0
  const activeKeys = sup.activeKeys

  // Determine demand from monitor predictions.
  const warn = s.predictions.filter((p) => p.status !== "ok").length
  const critical = s.predictions.filter((p) => p.status === "critical").length

  let status: FarmStatus = "monitor"
  let action = "observe"
  let gap = 0

  if (load.loadLevel === "high") {
    status = "throttled"
    action = "pause-system-heavy"
  } else if (critical > 0 || warn > 2) {
    status = "low"
    action = "farm-now"
    gap = Math.max(1, critical + warn)
  } else if (activeKeys < 3) {
    status = "critical"
    action = "urgent-farm"
    gap = 3 - activeKeys
  } else if (ratio < 0.4) {
    status = "surplus"
    action = "rest"
  } else {
    status = "balanced"
    action = "light-farming"
  }

  log.debug("orchestrator", `status=${status} active=${activeKeys} ratio=${ratio.toFixed(2)} load=${load.loadLevel}`)
  return { status, action, gap, ratio }
}

export interface CycleResult {
  status: FarmStatus
  action: string
  newGmails: number
  newKeys: number
  fixed: number
}

export async function runCycle(): Promise<CycleResult> {
  if (running) {
    log.warn("orchestrator", "Cycle already running, skipping")
    return { status: "monitor", action: "skip", newGmails: 0, newKeys: 0, fixed: 0 }
  }
  running = true
  let newGmails = 0
  let newKeys = 0
  let fixed = 0
  try {
    const decision = decide()

    // If we have a Gmail waiting on the user, do nothing — the user must
    // complete the verification before we can continue.
    const pending = pendingVerify()
    if (pending.length) {
      log.info("orchestrator", `${pending.length} Gmail(s) waiting on user verification — pausing`)
      return { status: "monitor", action: "await-user-verify", newGmails: 0, newKeys: 0, fixed: 0 }
    }

    if (decision.status === "throttled" || decision.status === "surplus") {
      log.info("orchestrator", `${decision.status} — resting`)
      return { status: decision.status, action: decision.action, newGmails: 0, newKeys: 0, fixed: 0 }
    }

    if (decision.status === "critical" || decision.status === "low") {
      // Create one new Gmail + farm providers for it.
      const accounts = await createMany(1)
      newGmails = accounts.length
      for (const acc of accounts) {
        if (acc.status !== "active") continue
        const keys = await farmForGmail(acc)
        newKeys += keys.length
        // Record demand side so the next cycle has more data.
        for (const k of keys) record(k.provider, 1000, "normal")
      }
    }

    // Always run fixers on critical cycles.
    if (decision.status === "critical") {
      const fixes = await runFixers()
      fixed = fixes.filter((f) => f.ok).length
    }

    return { status: decision.status, action: decision.action, newGmails, newKeys, fixed }
  } finally {
    running = false
  }
}

export function startLoop(intervalMs = 5 * 60_000): void {
  if (loopHandle) {
    log.warn("orchestrator", "Loop already running")
    return
  }
  log.ok("orchestrator", `Starting loop every ${intervalMs}ms`)
  void runCycle().catch((e) => log.error("orchestrator", String(e)))
  loopHandle = setInterval(() => {
    void runCycle().catch((e) => log.error("orchestrator", String(e)))
  }, intervalMs)
}

export function stopLoop(): void {
  if (!loopHandle) return
  clearInterval(loopHandle)
  loopHandle = null
  log.ok("orchestrator", "Loop stopped")
}

export function loopStatus(): { running: boolean; accounts: number } {
  return { running: !!loopHandle, accounts: listAccounts().length }
}

export function decidePublic() {
  return decide()
}

export function predictPublic() {
  return predictExhaustion()
}

export function loadPublic() {
  return loadLevel()
}