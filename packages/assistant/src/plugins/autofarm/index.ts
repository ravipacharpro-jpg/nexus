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

// ── Smart-upgrade commands ────────────────────────────────────────────

async function cmdEncrypt(ctx: PluginContext): Promise<number> {
  const { enableEncryption, isEncrypted } = await import("./lib/crypto-vault.ts")
  if (isEncrypted()) {
    ctx.out(`${Icon.info} vault already encrypted`)
    return 0
  }
  const r = enableEncryption(ctx.args[0])
  if (r.ok) ctx.out(`${Icon.success} vault encrypted → ${r.path}`)
  else { ctx.err(r.reason); return 1 }
  return 0
}

async function cmdDecrypt(ctx: PluginContext): Promise<number> {
  const { disableEncryption, isEncrypted } = await import("./lib/crypto-vault.ts")
  if (!isEncrypted()) {
    ctx.out(`${Icon.info} vault not encrypted`)
    return 0
  }
  const r = disableEncryption(ctx.args[0])
  if (r.ok) ctx.out(`${Icon.success} vault decrypted → ${r.path}`)
  else { ctx.err(r.reason); return 1 }
  return 0
}

async function cmdStealth(ctx: PluginContext): Promise<number> {
  const { newStealthProfile, humanTypingDelay } = await import("./lib/stealth.ts")
  const p = newStealthProfile()
  header("Stealth profile (this session)")
  ctx.out(`  user-agent:  ${p.userAgent}`)
  ctx.out(`  timezone:    ${p.timezone}`)
  ctx.out(`  locale:      ${p.locale}`)
  ctx.out(`  viewport:    ${p.viewport.width}×${p.viewport.height}`)
  ctx.out(`  cpu/mem:     ${p.hardwareConcurrency} cores / ${p.deviceMemory} GB`)
  ctx.out(`  speedFactor: ${p.speedFactor.toFixed(2)}`)
  ctx.out(`  typing delay sample: ${Math.round(humanTypingDelay(p))}ms`)
  return 0
}

async function cmdPredictMl(ctx: PluginContext): Promise<number> {
  const { predictAll } = await import("./lib/predictor.ts")
  const { listProviders } = await import("./agents/provider-agent.ts")
  const { snapshot } = await import("./agents/monitor-agent.ts")
  const mon = snapshot()
  const catalog = listProviders()
    .filter((p) => p.freePerDay && p.freePerDay > 0)
    .map((p) => ({ id: p.id, freePerDay: p.freePerDay }))
  const preds = predictAll(catalog, mon.usage)
  header("ML-based predictions (next 14 days)")
  for (const p of preds) {
    const flag = p.anomalyScore > 2 ? " ⚠ anomaly" : ""
    ctx.out(`  ${p.provider.padEnd(14)} used=${p.currentDaily} avg=${p.avgDaily} slope=${p.trendSlope} daysToExhaust=${p.daysToExhaust} conf=${p.confidence}${flag}`)
  }
  return 0
}

async function cmdPick(ctx: PluginContext): Promise<number> {
  const { pickKeyForTask, topProvidersForTask } = await import("./lib/selector.ts")
  const task = (ctx.args[0] ?? "any") as "code" | "chat" | "vision" | "long-context" | "any"
  header(`Best provider for task: ${task}`)
  for (const p of topProvidersForTask(task, 5)) {
    ctx.out(`  ${p.provider.padEnd(14)} score=${p.taskScore} ${p.reasons.join("; ")}`)
  }
  const pick = pickKeyForTask(task)
  if (pick) ctx.out(`\n  → selected ${pick.provider} (key masked in vault)`)
  else ctx.out(`\n  ${Icon.warn} no healthy key for ${task}`)
  return 0
}

async function cmdBrain(ctx: PluginContext): Promise<number> {
  const { runBrain, buildPrompt } = await import("./agents/llm-brain.ts")
  if (ctx.args[0] === "prompt") {
    ctx.out(buildPrompt())
    return 0
  }
  ctx.out(`${Icon.info} invoking LLM brain…`)
  const d = await runBrain()
  header("LLM brain decision")
  ctx.out(`  action:    ${d.action}`)
  ctx.out(`  urgency:   ${d.urgency}/5`)
  ctx.out(`  providers: ${d.providers.join(", ") || "(none)"}`)
  ctx.out(`  reason:    ${d.reason}`)
  for (const t of d.tasks) {
    ctx.out(`  task: ${t.task.padEnd(14)} → ${t.preferredProvider}  (${t.reason})`)
  }
  return 0
}

async function cmdCompress(ctx: PluginContext): Promise<number> {
  const { compressContext, DefaultConfig } = await import("./lib/compress.ts")
  if (ctx.args[0] === "demo") {
    const big = JSON.stringify({ items: Array.from({ length: 200 }, (_, i) => ({ id: i, name: "item " + i, desc: "x".repeat(500), meta: { created: new Date().toISOString() } })) }, null, 2)
    const messages = [
      { role: "system" as const, content: "You are a helper." },
      { role: "user" as const, content: "analyze this JSON please" },
      { role: "assistant" as const, content: "ok let me see..." },
      { role: "tool" as const, content: big },
      { role: "user" as const, content: "summarize" },
      { role: "user" as const, content: "now" },
    ]
    const r = compressContext({ messages, config: DefaultConfig })
    header("Compression demo")
    ctx.out(`  tokens: ${r.tokensBefore} -> ${r.tokensAfter} (saved ${r.tokensSaved}, ${(r.compressionRatio * 100).toFixed(1)}%)`)
    ctx.out(`  transforms: ${r.transformsApplied.join(", ") || "none"}`)
    ctx.out(`  inflation guard: ${r.inflationGuard ? "triggered" : "no"}`)
    return 0
  }
  ctx.out("Usage: nexus autofarm compress demo")
  return 1
}

async function cmdMemory(ctx: PluginContext): Promise<number> {
  const { startSession, completeSession, recordObservation, search, timeline, getObservationsByIds, getStats, memoryDir } = await import("./lib/memory.ts")
  const sub = ctx.args[0] ?? "stats"
  header("Memory subsystem (claude-mem-lite)")
  ctx.out(`  dir: ${dim(memoryDir())}`)
  if (sub === "stats") {
    const s = getStats()
    ctx.out(`  sessions:    ${s.sessions}`)
    ctx.out(`  observations: ${s.observations}`)
    ctx.out(`  oldest:      ${s.oldest ?? "(none)"}`)
    return 0
  }
  if (sub === "demo") {
    const sess = startSession("autofarm", "demo prompt from CLI")
    recordObservation({ memorySessionId: sess.memory_session_id, type: "feature", title: "Added compress.ts", text: "headroom-lite compression with 3 strategies", concepts: ["compression", "tokens"] })
    recordObservation({ memorySessionId: sess.memory_session_id, type: "feature", title: "Added memory.ts", text: "claude-mem-lite 3-layer search with JSONL storage", concepts: ["memory", "fts"] })
    completeSession(sess.memory_session_id)
    const s = getStats()
    ctx.out(`  + recorded 2 observations`)
    ctx.out(`  sessions: ${s.sessions} | observations: ${s.observations}`)
    return 0
  }
  if (sub === "search") {
    const q = ctx.args.slice(1).join(" ") || "compression"
    const r = search({ query: q, limit: 5 })
    ctx.out(`  query: "${q}"  total: ${r.totalResults}`)
    for (const o of r.observations) {
      ctx.out(`  #${o.id}  ${o.type.padEnd(10)}  ${o.title ?? "(no title)"}  ${o.created_at.slice(0, 19)}`)
      ctx.out(`         ${dim(o.snippet)}`)
    }
    return 0
  }
  if (sub === "timeline") {
    const rows = timeline({ depthBefore: 7, depthAfter: 0 })
    ctx.out(`  ${rows.length} observations in the last 7 days`)
    for (const o of rows) {
      ctx.out(`  #${o.id}  ${o.created_at.slice(0, 19)}  ${o.type}  ${o.title ?? ""}`)
    }
    return 0
  }
  ctx.out("Subcommands: stats | demo | search <query> | timeline")
  return 1
}

async function cmdLocal(ctx: PluginContext): Promise<number> {
  const { detectLocalServers, isReachable, pickCheapestModel, registerLocalProviders, chatLocal, evalDir: _ } = await import("./lib/local-llm.ts")
  const sub = ctx.args[0] ?? "scan"
  if (sub === "scan") {
    header("Local LLM servers (unsloth-lite)")
    ctx.out(`  Probing 5 common ports: 11434 (ollama), 8080 (llama.cpp), 8000 (vllm), 1234 (lmstudio), 11435 (unsloth)`)
    const found = await detectLocalServers()
    if (found.length === 0) {
      ctx.out(`  ${Icon.info} No local LLM server found. Start one of:`)
      ctx.out(`    ollama serve                # llama.cpp-compatible, port 11434`)
      ctx.out(`    unsloth start               # unsloth desktop`)
      ctx.out(`    llama-server -m model.gguf  # llama.cpp, port 8080`)
    } else {
      for (const s of found) {
        ctx.out(`  + ${s.name.padEnd(10)} ${s.baseUrl}  ${s.models.length} models  ${s.latencyMs}ms`)
        for (const m of s.models.slice(0, 5)) ctx.out(`      - ${m.id}${m.size ? ` (${(m.size / 1e9).toFixed(1)}GB)` : ""}`)
      }
    }
    return 0
  }
  if (sub === "register") {
    const found = await detectLocalServers()
    if (found.length === 0) {
      ctx.err("no local servers found")
      return 1
    }
    const r = registerLocalProviders(found)
    ctx.out(`  added:   ${r.added.join(", ") || "(none)"}`)
    ctx.out(`  skipped: ${r.skipped.join(", ") || "(none)"}`)
    return 0
  }
  if (sub === "chat") {
    const found = await detectLocalServers()
    if (found.length === 0) { ctx.err("no local servers"); return 1 }
    const pick = pickCheapestModel(found)
    if (!pick) { ctx.err("no models"); return 1 }
    const prompt = ctx.args.slice(1).join(" ") || "Say hi in 5 words"
    const r = await chatLocal(pick.server, pick.model, [{ role: "user", content: prompt }])
    header(`Local chat: ${pick.server.name} / ${pick.model}`)
    ctx.out(`  latency: ${r.latencyMs}ms`)
    ctx.out(`  reply:   ${r.content.slice(0, 500)}`)
    return 0
  }
  ctx.out("Subcommands: scan | register | chat <prompt>")
  return 1
}

async function cmdReview(ctx: PluginContext): Promise<number> {
  const { summarizeDiff, renderReview, reviewPatch, riskOf } = await import("./lib/pr-review.ts")
  const sub = ctx.args[0] ?? "demo"
  if (sub === "demo") {
    const samplePatch = [
      "diff --git a/packages/api/auth.ts b/packages/api/auth.ts",
      "--- a/packages/api/auth.ts",
      "+++ b/packages/api/auth.ts",
      "@@ -10,6 +10,8 @@ export function login(user, password) {",
      "   if (!user) return null",
      "+  const apiKey = process.env.API_KEY",
      "+  if (apiKey === 'sk-test1234567890abcdef') return user",
      "   const hash = bcrypt.hashSync(password, 10)",
      "   return db.query('SELECT * FROM users WHERE password = \"' + hash + '\"')",
    ].join("\n")
    const r = reviewPatch(samplePatch)
    ctx.out(r.review)
    return 0
  }
  if (sub === "patch") {
    const patch = ctx.args.slice(1).join(" ")
    if (!patch) { ctx.err("usage: nexus autofarm review patch <diff text>"); return 1 }
    const r = reviewPatch(patch)
    ctx.out(r.review)
    return 0
  }
  ctx.out("Subcommands: demo | patch <diff>")
  return 1
}

async function cmdEval(ctx: PluginContext): Promise<number> {
  const { startRun, listRuns, aggregateStats, getRun, evalDir } = await import("./lib/eval.ts")
  const sub = ctx.args[0] ?? "stats"
  if (sub === "demo") {
    const r = startRun("gmail-signup", { account: "nfarm***@gmail.com" })
    r.recordStep("navigate", { ok: true, ms: 1234 })
    r.recordStep("fill-form", { ok: true, ms: 567 })
    r.recordStep("submit", { ok: false, ms: 89, detail: "captcha" })
    r.score("success", 0.0, "rule:ok-false", "captcha blocked")
    r.score("speed", 0.6, "rule:duration", "1890ms total")
    const done = await r.finish({ ok: false, error: "captcha" })
    ctx.out(`  + run id: ${done.id}`)
    ctx.out(`  + steps:  ${done.steps.length}`)
    ctx.out(`  + scores: ${done.scores.length}`)
    return 0
  }
  if (sub === "stats") {
    const runs = listRuns(100)
    const stats = aggregateStats(runs)
    header("Agent eval (agenta-lite)")
    ctx.out(`  dir:        ${dim(evalDir())}`)
    ctx.out(`  total runs: ${stats.totalRuns}`)
    ctx.out(`  ok rate:    ${(stats.okRate * 100).toFixed(1)}%`)
    ctx.out(`  avg latency: ${stats.avgLatencyMs.toFixed(0)}ms`)
    if (Object.keys(stats.byTask).length > 0) {
      ctx.out("")
      ctx.out("  by task:")
      for (const [task, s] of Object.entries(stats.byTask)) {
        ctx.out(`    ${task.padEnd(20)} n=${s.count}  ok=${(s.okRate * 100).toFixed(0)}%  ms=${s.avgLatencyMs.toFixed(0)}`)
      }
    }
    if (Object.keys(stats.byScore).length > 0) {
      ctx.out("")
      ctx.out("  by score:")
      for (const [m, s] of Object.entries(stats.byScore)) {
        ctx.out(`    ${m.padEnd(20)} n=${s.count}  avg=${s.avgValue.toFixed(2)}`)
      }
    }
    return 0
  }
  if (sub === "list") {
    const runs = listRuns(20)
    ctx.out(`  ${runs.length} most recent runs`)
    for (const r of runs) {
      const status = r.ok ? Icon.success : Icon.warn
      ctx.out(`  ${status} ${r.id}  ${r.task.padEnd(20)}  ${r.totalMs ?? 0}ms  ${r.startedAt}`)
    }
    return 0
  }
  ctx.out("Subcommands: demo | stats | list")
  return 1
}

const plugin: NexusPlugin = {
  name: "autofarm",
  version: "0.2.1",
  description: "Autonomous API farmer: creates random Gmail accounts, farms free LLM API keys, keeps your vault topped up, and reasons about the best provider for each task.",
  tags: ["autonomous", "api", "gmail", "farm", "free", "smart", "stealth", "v0.1.66"],
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
    // ── Smart-upgrade commands ──
    { name: "encrypt", describe: "encrypt the API vault with AES-256-GCM", usage: "nexus autofarm encrypt [passphrase]", run: cmdEncrypt },
    { name: "decrypt", describe: "decrypt the API vault back to plaintext", usage: "nexus autofarm decrypt [passphrase]", run: cmdDecrypt },
    { name: "stealth", describe: "show the current anti-detection profile", usage: "nexus autofarm stealth", run: cmdStealth },
    { name: "predict-ml", describe: "ML-based usage prediction (rolling 14-day window)", usage: "nexus autofarm predict-ml", run: cmdPredictMl },
    { name: "pick", describe: "pick the best provider for a task", usage: "nexus autofarm pick <code|chat|vision|long-context|any>", run: cmdPick },
    { name: "brain", describe: "ask the LLM brain for the next move", usage: "nexus autofarm brain [prompt]", run: cmdBrain },
    { name: "compress", describe: "context compression demo (headroom-lite)", usage: "nexus autofarm compress demo", run: cmdCompress },
    { name: "memory", describe: "persistent cross-session memory (claude-mem-lite)", usage: "nexus autofarm memory <stats|demo|search|timeline>", run: cmdMemory },
    { name: "local", describe: "local LLM server detection (unsloth-lite)", usage: "nexus autofarm local <scan|register|chat>", run: cmdLocal },
    { name: "review", describe: "PR review from a diff (pr-review-lite)", usage: "nexus autofarm review <demo|patch>", run: cmdReview },
    { name: "eval", describe: "agent eval/leaderboard (agenta-lite)", usage: "nexus autofarm eval <demo|stats|list>", run: cmdEval },
  ],
}

export default plugin
export * as AutofarmPlugin from "./agents/orchestrator.ts"