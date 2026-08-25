## NEXUS v1.0.0 — Independent Release (New Versioning Start)

First independent release of this fork, starting a fresh versioning line at **1.0.0**.
This release carries the complete upstream state to date plus all local fixes —
fully self-contained and maintained from this repository going forward.

### Included

**Complete upstream sync (through the v0.1.58 line)**
- Every maintainer update, fix, and test improvement merged to date
- Session core V2, provider rotation, memory lifecycle, model availability badges
- Health-aware fast routing with last-key fallback during cooldown
- Git Pro safety: diff-first confirmed commits, legacy flag repairs
- Cloudflare Workers AI vault flow + provider policy/local caps
- UI: factual session route status, bounded agent plans, capability views
- Assistant security round-2: voice redaction, deploy gates, secret input hardening

**Assistant ecosystem & API vault**
- Full assistant ecosystem: 16+ plugins (codegen, copilot, cpanel, deploy,
  devtools, gitpro, integrations, recovery, security, termux, translate,
  undo-ai, voice, webtest, workspace)
- API vault upgrade with encrypted secret store and verified-access ranking
- 24x7 daemon for always-on operation
- Multi-viewport visual QA + screen-to-code recorder (webtest)

**Termux reliability fixes (issue #2 series)**
- Backup overwrite protection and honest success reporting
- Task queue JSON contract + tool registry with dedupe
- Writable task-status root via `os.tmpdir()` — status files now work on
  native Termux where `/tmp` is read-only rootfs *(re-applied in this release)*
- Bare-task failures exit non-zero with clean errors instead of leaking internals
- English-only CLI strings for consistent scripting output

**Platform**
- Binaries: `nexus-linux-arm64` and `nexus-linux-x64` (glibc)
- Typecheck-clean assistant package; safety test suites green
