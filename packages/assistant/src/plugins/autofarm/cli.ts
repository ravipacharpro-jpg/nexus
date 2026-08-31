// Standalone CLI for NEXUS autofarm v0.1.67
// Compiled with bun to a single-file executable.
// Usage: ./nexus-autofarm status / scout / run / health / etc.

import { taskQueue } from "./lib/queue.ts"
import { vaultSummary } from "./lib/vault.ts"
import { snapshotSupply, snapshotDemand, decide as dsDecide } from "./lib/demand-supply.ts"
import { healthCheck, startHealing } from "./lib/auto-fixer.ts"
import { listCustomProviders, removeCustomProvider } from "./lib/demand-supply.ts"
import { scoutAll, freeAndCompatible } from "./lib/api-scout.ts"
import { listManagedProviders, manageOnce } from "./agents/api-manager-agent.ts"
import { detectOnce, startMonitoring, getRecentBugs, thisDevice, bugLogPath } from "./lib/bug-detector.ts"
import { recordReport, formatForNUI, getLatestReport, latestReportPath } from "./lib/bug-reporter.ts"
import { sendWebhook } from "./lib/webhooks.ts"
import { log } from "./lib/logger.ts"

const BANNER = `
  ███╗   ██╗███████╗██╗  ██╗██╗   ██╗███████╗
  ████╗  ██║██╔════╝╚██╗██╔╝██║   ██║██╔════╝
  ██╔██╗ ██║█████╗   ╚███╔╝ ██║   ██║███████╗
  ██║╚██╗██║██╔══╝   ██╔██╗ ██║   ██║╚════██║
  ██║ ╚████║███████╗██╔╝ ██╗╚██████╔╝███████║
  ╚═╝  ╚═══╝╚══════╝╚═╝  ╚═╝ ╚═════╝ ╚══════╝

NEXUS autofarm v0.1.67 (standalone)
`

function header(title: string): string {
  return `\x1b[1;38;2;124;58;237m▣ ${title}\x1b[0m \x1b[2;38;2;82;82;91m${"─".repeat(Math.max(8, 60 - title.length - 4))}\x1b[0m`
}

function main() {
  const args = process.argv.slice(2)
  const cmd = args[0] ?? "help"

  console.log(BANNER)
  console.log(`platform: ${process.platform}/${process.arch}  node: ${process.version}`)
  console.log("")

  switch (cmd) {
    case "status": {
      (() => {
        const sum = vaultSummary()
        const sup = snapshotSupply()
        const dec = dsDecide()
        console.log(header("VAULT"))
        console.log(`  providers:  ${sum.providers}`)
        console.log(`  total keys: ${sum.totalKeys}`)
        console.log(`  active:     ${sum.activeKeys}`)
        console.log("")
        console.log(header("DEMAND-SUPPLY"))
        console.log(`  status:      ${dec.status}`)
        console.log(`  recommend:   ${dec.recommendation}`)
        console.log(`  reasoning:   ${dec.reasoning}`)
        console.log("")
        console.log("providers:")
        for (const p of sup.providers.slice(0, 10)) {
          const ratio = p.dailyLimit > 0 ? (p.usedToday / p.dailyLimit * 100).toFixed(0) + "%" : "-"
          console.log(`  ${p.id.padEnd(14)} keys=${p.activeKeys} used=${p.usedToday}/${p.dailyLimit} (${ratio})`)
        }
      })()
      return
    }

    case "scout": {
      (async () => {
        console.log(header("INTERNET-WIDE FREE LLM SCOUT"))
        console.log("searching HN, GitHub, Reddit, dev.to...")
        const all = await scoutAll()
        const good = freeAndCompatible(all)
        console.log(`  found: ${all.length} candidates, ${good.length} free+openai-compat`)
        for (const c of good.slice(0, 8)) {
          console.log(`    [${c.source.padEnd(11)}] ${(c.score * 100).toFixed(0).padStart(3)}%  ${c.title.slice(0, 50)}`)
          console.log(`                  ${c.url.slice(0, 70)}`)
        }
      })()
      return
    }

    case "run": {
      (async () => {
        console.log(header("FULL DEMAND-SUPPLY CYCLE"))
        const r = await manageOnce({})
        console.log(`  providers:    ${r.providers.length}`)
        console.log(`  active:       ${r.totalActive}`)
        console.log(`  utilization:  ${(r.utilizationPct * 100).toFixed(1)}%`)
        console.log(`  candidates:   ${r.candidates.length}`)
        console.log(`  next action:  ${r.nextAction}`)
        if (r.actions.length) {
          console.log("  actions:")
          for (const a of r.actions) console.log(`    + ${a}`)
        }
      })()
      return
    }

    case "health": {
      (() => {
        console.log(header("SELF-HEALING HEALTH CHECK"))
        const dry = args[1] === "--dry-run"
        if (dry) console.log("  (DRY RUN)")
        const s = healthCheck(dry)
        console.log(`  findings:  ${s.findings}`)
        console.log(`  fixed:     ${s.fixed}`)
        console.log(`  need user: ${s.needsUser}`)
        console.log(`  failed:    ${s.failed}`)
        console.log(`  duration:  ${s.totalMs}ms`)
        if (s.details.length === 0) {
          console.log("  ✓ all green — no issues found")
        } else {
          for (const d of s.details) {
            const icon = d.status === "applied" ? "✓" : d.status === "needs-user" ? "!" : d.status === "failed" ? "✗" : "·"
            console.log(`  ${icon} [${d.severity}/${d.category}] ${d.title}`)
            console.log(`     ${d.message}`)
          }
        }
        if (!dry && s.findings > 0) {
          const rep = recordReport(s)
          console.log("")
          console.log(`  → report saved: ${latestReportPath()}`)
        }
      })()
      return
    }

    case "report": {
      (() => {
        const r = getLatestReport()
        if (!r) {
          console.log("no report yet — run: nexus-autofarm health")
          return
        }
        console.log(formatForNUI(r))
      })()
      return
    }

    case "bugs": {
      const sub = args[1] ?? "scan"
      if (sub === "scan") {
        (() => {
          console.log(header("BUG DETECTOR SCAN"))
          const findings = detectOnce()
          console.log(`  findings: ${findings.length}`)
          for (const f of findings) {
            console.log(`  ${f.severity.toUpperCase().padEnd(8)} [${f.category}] ${f.title}`)
            if (f.suggestedFix) console.log(`           fix: ${f.suggestedFix}`)
          }
        })()
        return
      }
      if (sub === "device") {
        (() => {
          const d = thisDevice()
          console.log(header("THIS DEVICE"))
          console.log(`  hostname:  ${d.hostname}`)
          console.log(`  os:        ${d.os}`)
          console.log(`  arch:      ${d.arch}`)
          console.log(`  uptime:    ${Math.round(d.uptime)}s`)
        })()
        return
      }
      if (sub === "monitor") {
        (() => {
          const interval = Number(args[2]) || 60_000
          const m = startMonitoring(interval)
          console.log(header("REAL-TIME MONITOR STARTED"))
          console.log(`  interval: ${interval}ms`)
          console.log(`  mode:     continuous (no login required)`)
          console.log("  press Ctrl+C to stop")
        })()
        return
      }
    }

    case "queue": {
      (() => {
        const s = taskQueue.status()
        console.log(header("TASK QUEUE"))
        console.log(`  pending: ${s.pending}`)
        console.log(`  done:    ${s.done}`)
        console.log(`  failed:  ${s.failed}`)
        console.log(`  by type:`)
        for (const [t, c] of Object.entries(s.byType)) console.log(`    ${t.padEnd(20)} ${c}`)
      })()
      return
    }

    case "heal": {
      (() => {
        const interval = Number(args[1]) || 5 * 60_000
        const m = startHealing(interval)
        console.log(header("SELF-HEALING STARTED"))
        console.log(`  interval: ${interval / 1000}s`)
        console.log(`  mode:     detect → fix → record (continuous)`)
        console.log("  press Ctrl+C to stop")
      })()
      return
    }

    case "version":
    case "--version":
    case "-v": {
      console.log("NEXUS autofarm v0.1.67 (standalone)")
      console.log(`  platform: ${process.platform}/${process.arch}`)
      console.log(`  node:     ${process.version}`)
      console.log(`  ts:       0.1.67`)
      return
    }

    case "help":
    default: {
      console.log("Available commands:")
      const cmds = [
        ["status", "show vault + decisions + provider health"],
        ["scout", "search internet for new free LLM providers"],
        ["run", "full demand-supply cycle"],
        ["health", "auto-fix bugs and persist report"],
        ["report", "show last health report"],
        ["bugs <scan|device|monitor>", "real-time bug detector"],
        ["queue", "task queue status"],
        ["heal [ms]", "start self-healing loop"],
        ["version", "show version"],
        ["help", "this help"],
      ]
      for (const [c, d] of cmds) console.log(`  ${c.padEnd(28)} ${d}`)
      return
    }
  }
}

main()
