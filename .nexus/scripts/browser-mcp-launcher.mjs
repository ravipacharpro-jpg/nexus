#!/usr/bin/env node
// Portable Playwright MCP launcher for NEXUS.
// NEXUS spawns THIS script (cross-platform via `node`). It detects the platform and
// runs the Playwright MCP server the right way:
//   - Termux / Android: inside a proot-distro Ubuntu container (where process.platform === "linux",
//     so Playwright's Chromium actually runs). A one-time bootstrap installs Ubuntu + Chromium there.
//   - Windows / macOS / Linux desktop: directly via `npx -y @playwright/mcp` (auto-installs).
// All CLI args from the NEXUS mcp config are forwarded unchanged.
import { spawn, spawnSync } from "node:child_process";

const args = process.argv.slice(2);

function isAndroid() {
  if (process.platform === "android") return true;
  try {
    return spawnSync("proot-distro", ["--version"], { stdio: "ignore" }).status === 0;
  } catch {
    return false;
  }
}

function launch(cmd, cmdArgs) {
  const child = spawn(cmd, cmdArgs, { stdio: "inherit" });
  child.on("exit", (code) => process.exit(code ?? 0));
  child.on("error", (err) => {
    console.error("browser-mcp-launcher: failed to start", cmd, cmdArgs.join(" "), err.message);
    process.exit(1);
  });
}

if (isAndroid()) {
  // Termux/Android: run inside Ubuntu proot. Prefer the global bin; fall back to npx.
  let bin = "npx";
  let binArgs = ["-y", "@playwright/mcp"];
  try {
    const r = spawnSync("proot-distro", ["login", "ubuntu", "--", "bash", "-c", "command -v playwright-mcp"], { encoding: "utf8" });
    const found = (r.stdout || "").trim();
    if (found) {
      bin = "playwright-mcp";
      binArgs = [];
    }
  } catch {}
  launch("proot-distro", ["login", "ubuntu", "--", bin, ...binArgs, ...args]);
} else {
  // Desktop (win32/darwin/linux): run directly.
  launch("npx", ["-y", "@playwright/mcp", ...args]);
}
