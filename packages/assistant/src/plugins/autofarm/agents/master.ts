// Master farm command — combines the in-process autofarm pipeline with
// the existing Python-based nexus-keyfarm subsystem.
//
//   1. Read demand-supply snapshot
//   2. Run in-process orchestrator decide() / cycle()
//   3. If Python bridge is installed, also kick a --auto cycle on the Python side
//   4. Pull demand-supply + farm-log JSON for the operator
//
// The goal is to let `nexus autofarm master` give a single comprehensive
// status without the operator having to remember which subsystem each
// command lives in.

import { log } from "../lib/logger.ts"
import { decidePublic, predictPublic, loadPublic, runCycle, startLoop, stopLoop, loopStatus } from "./orchestrator.ts"
import { pythonBridge, pythonInstalled } from "../lib/python-bridge.ts"
import { snapshot as monitorSnapshot } from "./monitor-agent.ts"
import { vaultSummary } from "../lib/vault.ts"
import { pendingVerify, listAccounts } from "./gmail-agent.ts"

export interface MasterReport {
  ts: string
  inProcess: {
    decision: ReturnType<typeof decidePublic>
    load: ReturnType<typeof loadPublic>
    loopRunning: boolean
    predictions: ReturnType<typeof predictPublic>
    monitor: ReturnType<typeof monitorSnapshot>
    vault: ReturnType<typeof vaultSummary>
    pendingVerify: number
    activeGmails: number
  }
  python: {
    available: boolean
    autoRan: boolean
    stdoutTail: string
    stderrTail: string
    ms: number
    ok: boolean
  } | null
}

export async function runMaster(opts: { autoRunPython?: boolean; intervalMs?: number } = {}): Promise<MasterReport> {
  const inProcess = {
    decision: decidePublic(),
    load: loadPublic(),
    loopRunning: loopStatus().running,
    predictions: predictPublic(),
    monitor: monitorSnapshot(),
    vault: vaultSummary(),
    pendingVerify: pendingVerify().length,
    activeGmails: listAccounts().filter((a) => a.status === "active").length,
  }
  log.info("master", `decision=${inProcess.decision.status} action=${inProcess.decision.action}`)

  // Always run one orchestrator cycle to keep the vault fresh.
  await runCycle().catch((e) => log.warn("master", `cycle failed: ${(e as Error).message}`))

  // If the operator asked for it, kick a Python --auto as well.
  let python: MasterReport["python"] = null
  if (pythonInstalled()) {
    if (opts.autoRunPython) {
      const r = await pythonBridge.autoFarm()
      python = {
        available: true,
        autoRan: true,
        stdoutTail: r.stdout.slice(-2000),
        stderrTail: r.stderr.slice(-1000),
        ms: r.ms,
        ok: r.ok,
      }
    } else {
      const snap = await pythonBridge.demandSnapshot()
      python = {
        available: true,
        autoRan: false,
        stdoutTail: snap.stdout.slice(-2000),
        stderrTail: snap.stderr.slice(-500),
        ms: snap.ms,
        ok: snap.ok,
      }
    }
  } else {
    log.warn("master", "Python keyfarm subsystem not found — running only in-process pipeline")
  }

  return { ts: new Date().toISOString(), inProcess, python }
}

export function startMasterLoop(intervalMs = 5 * 60_000): void {
  startLoop(intervalMs)
  log.info("master", "Both in-process orchestrator and master loop started")
}

export function stopMasterLoop(): void {
  stopLoop()
  log.info("master", "Stopped")
}