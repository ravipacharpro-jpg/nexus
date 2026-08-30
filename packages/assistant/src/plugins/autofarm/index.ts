// NEXUS Autonomous API Farmer — plugin entry.
// Registers all subcommands with the NEXUS CLI.

import { dim, Icon, Style } from "../core/style"
import type { NexusPlugin, PluginContext } from "../core/types"
import { listProviders, farmForGmail } from "./agents/provider-agent.ts"
import { createMany, listAccounts, markVerified, pendingVerify } from "./agents/gmail-agent.ts"
import { runCycle, startLoop, stopLoop, loopStatus, decidePublic, predictPublic } from "./agents/orchestrator.ts"
import { runMaster, startMasterLoop, stopMasterLoop } from "./agents/master.ts"
import { runFixers } from "./agents/fixer-agent.ts"
import { snapshot } from "./agents/monitor-agent.ts"
import { vaultSummary, vaultPath } from "./lib/vault.ts"
import { logFile } from "./lib/logger.ts"
import { topModels, discoverProviders } from "./agents/demand-agent.ts"
import { pythonBridge, pythonInstalled } from "./lib/python-bridge.ts"

function header(title: string): void {
  process.stdout.write(`\n${Style.TEXT_HIGHLIGHT_BOLD}${title}${Style.TEXT_NORMAL}\n`)
}

async function cmdStart(ctx: PluginContext): Promise<number> {
  const interval = Number(ctx.args[0]) || 5 * 60_000
  startLoop(interval)
  ctx.out(`${Icon.success} Autofarm loop started every ${interval}ms`)
  return 0
}

async function cmdStop(ctx: PluginContext): Promise<number> {
  stopLoop()
  ctx.out(`${Icon.success} Autofarm loop stopped`)
  return 0
}

async function cmdStatus(ctx: PluginContext): Promise<number> {
  const decision = decidePublic()
  const s = snapshot()
  const v = vaultSummary()
  header("Autofarm status")
  ctx.out(`  loop:           ${loopStatus().running ? Style.TEXT_SUCCESS_BOLD + "running" + Style.TEXT_NORMAL : dim("stopped")}`)
  ctx.out(`  decision:       ${decision.status} → ${decision.action}`)
  ctx.out(`  vault:          ${v.providers} providers, ${v.activeKeys} active / ${v.totalKeys} total`)
  ctx.out(`  system load:    ${s.load.loadLevel} (cpu ${s.load.cpu.toFixed(2)})`)
  ctx.out(`  pending verify: ${pendingVerify().length} Gmail(s)`)
  ctx.out(`  log file:       ${dim(logFile())}`)
  ctx.out(`  vault file:     ${dim(vaultPath())}`)
  ctx.out("")
  ctx.out(`  ${dim("Predictions:")}`)
  for (const p of s.predictions) {
    ctx.out(`    ${p.provider.padEnd(14)} used=${p.usedToday} status=${p.status}`)
  }
  return 0
}

async function cmdCreateGmail(ctx: PluginContext): Promise<number> {
  const n = Number(ctx.args[0]) || 1
  const out = await createMany(n)
  ctx.out(`${Icon.success} Created ${out.length} Gmail account(s):`)
  for (const a of out) {
    ctx.out(`  - ${a.email} status=${a.status} method=${a.method}`)
    if (a.verifyUrl) ctx.out(`    ${Style.TEXT_HIGHLIGHT}verify:${Style.TEXT_NORMAL} ${a.verifyUrl}`)
  }
  return 0
}

async function cmdExtract(ctx: PluginContext): Promise<number> {
  const accounts = listAccounts().filter((a) => a.status === "active")
  if (!accounts.length) {
    ctx.err("No active Gmail accounts. Run `nexus autofarm create-gmail` first.")
    return 1
  }
  let total = 0
  for (const acc of accounts) {
    ctx.out(`${Icon.info} Farming providers for ${acc.email}...`)
    const keys = await farmForGmail(acc)
    total += keys.length
  }
  ctx.out(`${Icon.success} Extracted ${total} API key(s)`)
  return 0
}

async function cmdVerify(ctx: PluginContext): Promise<number> {
  const email = ctx.args[0]
  if (!email) {
    ctx.err("Usage: nexus autofarm verify-email <email> [ok|fail]")
    return 1
  }
  const ok = (ctx.args[1] || "ok") === "ok"
  markVerified(email, ok)
  ctx.out(`${Icon.success} Marked ${email} as ${ok ? "verified" : "failed"}`)
  return 0
}

async function cmdCycle(ctx: PluginContext): Promise<number> {
  const r = await runCycle()
  ctx.out(`${Icon.success} Cycle done: status=${r.status} newGmails=${r.newGmails} newKeys=${r.newKeys} fixed=${r.fixed}`)
  return 0
}

async function cmdFix(ctx: PluginContext): Promise<number> {
  const fixes = await runFixers()
  ctx.out(`${Icon.success} Fixer pass complete (${fixes.length} actions)`)
  for (const f of fixes) ctx.out(`  - ${f.kind}: ${f.ok ? "ok" : "FAIL"} ${f.detail}`)
  return 0
}

async function cmdDemand(ctx: PluginContext): Promise<number> {
  const what = ctx.args[0]
  if (what === "search") {
    const r = await discoverProviders()
    ctx.out(`${Icon.info} ${r.length} candidates:`)
    for (const x of r) ctx.out(`  - ${x.title}\n    ${dim(x.url)}`)
    return 0
  }
  const top = topModels()
  ctx.out(`${Icon.info} Top requested models:`)
  for (const m of top) ctx.out(`  - ${m.model} (${m.tokens} tokens, ${m.count} reqs)`)
  return 0
}

async function cmdProviders(ctx: PluginContext): Promise<number> {
  const list = listProviders()
  ctx.out(`${Icon.info} ${list.length} providers configured:`)
  for (const p of list) {
    ctx.out(`  - ${p.name.padEnd(14)} ${p.label.padEnd(20)} ${p.freePerDay}/day, ${p.models.length} model(s)`)
  }
  return 0
}

async function cmdPredict(ctx: PluginContext): Promise<number> {
  const p = predictPublic()
  ctx.out(`${Icon.info} Predictions:`)
  for (const r of p) ctx.out(`  - ${r.provider}: ${r.status} (${r.usedToday} used)`)
  return 0
}

async function cmdMaster(ctx: PluginContext): Promise<number> {
  const autoRunPython = ctx.args.includes("--python") || ctx.args.includes("-p")
  const startLoopFlag = ctx.args.includes("--loop")
  if (startLoopFlag) startMasterLoop()

  const r = await runMaster({ autoRunPython })
  header("Master report")
  ctx.out(`  ${Style.TEXT_HIGHLIGHT_BOLD}in-process${Style.TEXT_NORMAL}`)
  ctx.out(`    decision: ${r.inProcess.decision.status} → ${r.inProcess.decision.action}`)
  ctx.out(`    vault:    ${r.inProcess.vault.activeKeys} active / ${r.inProcess.vault.totalKeys} total across ${r.inProcess.vault.providers} providers`)
  ctx.out(`    gmails:   ${r.inProcess.activeGmails} active, ${r.inProcess.pendingVerify} pending verify`)
  ctx.out(`    load:     ${r.inProcess.load.loadLevel} (cpu ${r.inProcess.load.cpu.toFixed(2)})`)
  ctx.out(`    loop:     ${r.inProcess.loopRunning ? "running" : "stopped"}`)

  if (r.python) {
    ctx.out(`  ${Style.TEXT_HIGHLIGHT_BOLD}python keyfarm${Style.TEXT_NORMAL}`)
    ctx.out(`    available: ${r.python.available ? "yes" : "no"}`)
    if (r.python.autoRan) {
      ctx.out(`    auto-ran:  yes (${r.python.ms}ms, ok=${r.python.ok})`)
      if (r.python.stdoutTail.trim()) {
        ctx.out(`    --- tail ---`)
        ctx.out(dim(r.python.stdoutTail.trim().split("\n").slice(-12).join("\n")))
      }
    } else if (r.python.stdoutTail.trim()) {
      ctx.out(`    snapshot:  ${r.python.ms}ms`)
      ctx.out(dim(r.python.stdoutTail.trim().split("\n").slice(-8).join("\n")))
    }
  } else {
    ctx.out(`  ${dim("python keyfarm: not installed (only in-process pipeline ran)")}`)
  }

  return 0
}

async function cmdPython(ctx: PluginContext): Promise<number> {
  if (!pythonInstalled()) {
    ctx.err("Python keyfarm subsystem not found at ~/nexus-keyfarm")
    return 1
  }
  const sub = ctx.args[0] ?? "status"
  let r
  switch (sub) {
    case "status": r = await pythonBridge.status(); break
    case "auto":   r = await pythonBridge.autoFarm(); break
    case "farm":   r = await pythonBridge.forceFarm(); break
    case "test":   r = await pythonBridge.liveTest(); break
    case "demand": r = await pythonBridge.demandSnapshot(); break
    case "gmails": r = await pythonBridge.gmailStatus(); break
    case "create":
      r = await pythonBridge.createGmail(Number(ctx.args[1]) || 1)
      break
    default:
      ctx.err(`Unknown python subcommand: ${sub}`)
      ctx.out("Available: status, auto, farm, test, demand, gmails, create N")
      return 1
  }
  ctx.out(r.stdout || "(no output)")
  if (r.stderr.trim()) ctx.out(`stderr: ${r.stderr.trim()}`)
  return r.ok ? 0 : 1
}

async function cmdLoop(ctx: PluginContext): Promise<number> {
  const action = ctx.args[0]
  if (action === "start") {
    startLoop(Number(ctx.args[1]) || 5 * 60_000)
    ctx.out(`${Icon.success} loop started`)
  } else if (action === "stop") {
    stopLoop()
    ctx.out(`${Icon.success} loop stopped`)
  } else {
    ctx.out(`loop: ${loopStatus().running ? "running" : "stopped"}`)
  }
  return 0
}

const plugin: NexusPlugin = {
  name: "autofarm",
  version: "0.1.0",
  description: "Autonomous API farmer: creates random Gmail accounts, farms free LLM API keys, and keeps your vault topped up.",
  tags: ["autonomous", "api", "gmail", "farm", "free"],
  commands: [
    { name: "start", describe: "start background loop", usage: "nexus autofarm start [intervalMs]", run: cmdStart },
    { name: "stop", describe: "stop background loop", usage: "nexus autofarm stop", run: cmdStop },
    { name: "status", describe: "show autofarm status", usage: "nexus autofarm status", run: cmdStatus },
    { name: "create-gmail", describe: "create N anonymous Gmail(s)", usage: "nexus autofarm create-gmail [N]", run: cmdCreateGmail },
    { name: "extract-keys", describe: "farm API keys using existing Gmail(s)", usage: "nexus autofarm extract-keys", run: cmdExtract },
    { name: "verify-email", describe: "mark a Gmail as verified after human solve", usage: "nexus autofarm verify-email <email> [ok|fail]", run: cmdVerify },
    { name: "cycle", describe: "run one orchestrator cycle", usage: "nexus autofarm cycle", run: cmdCycle },
    { name: "fix", describe: "run the fixer agent", usage: "nexus autofarm fix", run: cmdFix },
    { name: "demand", describe: "show demand or search the web for new providers", usage: "nexus autofarm demand [search]", run: cmdDemand },
    { name: "providers", describe: "list configured free providers", usage: "nexus autofarm providers", run: cmdProviders },
    { name: "predict", describe: "predict exhaustion per provider", usage: "nexus autofarm predict", run: cmdPredict },
    { name: "master", describe: "unified master report (in-process + python)", usage: "nexus autofarm master [--python] [--loop]", run: cmdMaster },
    { name: "python", describe: "drive the Python nexus-keyfarm subsystem", usage: "nexus autofarm python <status|auto|farm|test|demand|gmails|create N>", run: cmdPython },
    { name: "loop", describe: "start/stop/check the orchestrator loop", usage: "nexus autofarm loop [start [ms]|stop]", run: cmdLoop },
  ],
}

export default plugin
export * as AutofarmPlugin from "./agents/orchestrator.ts"