#!/usr/bin/env node
// Portable Playwright MCP launcher for NEXUS.
// NEXUS spawns THIS script (cross-platform via `node`). It detects the platform and
// runs the Playwright MCP server the right way:
//   - Termux / Android: inside a proot-distro Ubuntu container (where process.platform === "linux",
//     so Playwright's Chromium actually runs). A one-time bootstrap installs Ubuntu + Chromium there.
//   - Windows / macOS / Linux desktop: directly via `npx -y @playwright/mcp` (auto-installs).
// All CLI args from the NEXUS mcp config are forwarded unchanged.
import { spawn, spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

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
  // Termux/Android: self-heal only if the environment looks incomplete, so normal
  // startup stays fast (no apt/network on every launch).
  const ready = spawnSync(
    "proot-distro",
    ["login", "ubuntu", "--", "bash", "-c", "command -v playwright-mcp >/dev/null && test -n \"$(ls -d $HOME/.cache/ms-playwright/chromium* 2>/dev/null)\""],
    { stdio: "ignore" }
  ).status === 0;
  if (!ready) {
    const ensureScript = fileURLToPath(new URL("./ensure-browser-env.sh", import.meta.url));
    console.error("browser-mcp-launcher: browser env incomplete, running ensure-browser-env.sh ...");
    const ensureResult = spawnSync("bash", [ensureScript], { stdio: "inherit" });
    if (ensureResult.status !== 0) {
      console.error("browser-mcp-launcher: ensure-browser-env.sh failed; attempting to start server anyway.");
    }
  }
  // Prefer the global bin; fall back to npx.
  let bin = "npx";
  let binArgs = ["-y", "@playwright/mcp"];
  const r = spawnSync("proot-distro", ["login", "ubuntu", "--", "bash", "-c", "command -v playwright-mcp"], { encoding: "utf8" });
  const found = (r.stdout || "").trim();
  if (found) {
    bin = "playwright-mcp";
    binArgs = [];
  }
  launch("proot-distro", ["login", "ubuntu", "--", bin, ...binArgs, ...args]);
} else {
  // Desktop (win32/darwin/linux): run directly.
  launch("npx", ["-y", "@playwright/mcp", ...args]);
}
