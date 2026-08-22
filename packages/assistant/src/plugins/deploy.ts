import path from "path"
import { Style, Icon } from "../core/style"
import type { NexusPlugin, PluginContext } from "../core/types"

async function sshDeploy(ctx: PluginContext): Promise<number | void> {
  const host = typeof ctx.flags.host === "string" ? ctx.flags.host : undefined
  const user = typeof ctx.flags.user === "string" ? ctx.flags.user : undefined
  const local = path.resolve(ctx.cwd, typeof ctx.flags.local === "string" ? ctx.flags.local : "./dist")
  const remote = typeof ctx.flags.remote === "string" ? ctx.flags.remote : "/var/www/html"
  const key = typeof ctx.flags.key === "string" ? ctx.flags.key : path.join(process.env.HOME ?? "~", ".ssh", "id_rsa")

  if (!host || !user) {
    ctx.err("Usage: nexus deploy ssh --host myserver.com --user deploy --local ./dist --remote /var/www/html")
    return 1
  }

  if (!(await Bun.file(local).exists())) {
    ctx.err(`Local path not found: ${local}`)
    return 1
  }

  const ok = await ctx.confirm({
    title: `Deploy ${path.basename(local)} → ${user}@${host}:${remote}?`,
    danger: false,
  })
  if (!ok) {
    ctx.out("Deploy cancelled")
    return 0
  }

  const rsync = Bun.which("rsync")
  if (rsync) {
    ctx.out(`${Icon.rocket} rsync incremental sync...`)
    const proc = Bun.spawn(
      ["rsync", "-avz", "--delete", "-e", `ssh -i ${key} -o StrictHostKeyChecking=accept-new`, `${local}/`, `${user}@${host}:${remote}/`],
      { stdout: "inherit", stderr: "inherit" },
    )
    const exit = await proc.exited
    if (exit !== 0) {
      ctx.err("rsync failed")
      return 1
    }
  } else {
    ctx.out(`${Icon.warn} rsync not found — using scp fallback`)
    const proc = Bun.spawn(["scp", "-r", "-i", key, local, `${user}@${host}:${remote}`], { stdout: "inherit", stderr: "inherit" })
    const exit = await proc.exited
    if (exit !== 0) {
      ctx.err("scp failed")
      return 1
    }
  }

  await healthCheck(ctx, host)
}

async function healthCheck(ctx: PluginContext, host: string): Promise<void> {
  for (const scheme of ["https", "http"]) {
    try {
      const response = await fetch(`${scheme}://${host}`, { method: "HEAD", signal: AbortSignal.timeout(8000) })
      ctx.out(`${Icon.success} Health check: ${scheme}://${host} → HTTP ${response.status}`)
      return
    } catch {
      continue
    }
  }
  ctx.out(`${Icon.warn} Health check could not reach ${host}`)
}

async function gitDeploy(ctx: PluginContext): Promise<number | void> {
  const remote = typeof ctx.flags.remote === "string" ? ctx.flags.remote : "origin"
  const branch = typeof ctx.flags.branch === "string" ? ctx.flags.branch : "main"

  const proc = Bun.spawn(["git", "push", remote, branch], { cwd: ctx.cwd, stdout: "inherit", stderr: "inherit" })
  const exit = await proc.exited
  if (exit !== 0) {
    ctx.err(`git push failed (${remote}/${branch})`)
    return 1
  }
  ctx.out(`${Icon.success} Pushed to ${remote}/${branch}`)
}

const plugin: NexusPlugin = {
  name: "deploy",
  version: "0.1.0",
  description: "Deployment engine — SSH/rsync and Git push with health checks",
  tags: ["deploy", "ssh", "rsync", "git"],
  commands: [
    {
      name: "ssh",
      describe: "deploy a directory over SSH (rsync preferred, scp fallback)",
      usage: "nexus deploy ssh --host H --user U [--local ./dist] [--remote /var/www/html] [--key ~/.ssh/id_rsa]",
      run: sshDeploy,
    },
    {
      name: "ftp",
      describe: "FTP/SFTP deploy requires the optional 'basic-ftp' or 'ssh2' package",
      usage: "nexus deploy ftp --host H --user U --local ./build --remote /public_html",
      run: async (ctx) => {
        ctx.err("FTP support needs the optional dependency 'basic-ftp' — install it, or use: nexus deploy ssh")
        return 1
      },
    },
    {
      name: "git",
      describe: "git push deploy, e.g. nexus deploy git --remote origin --branch main",
      usage: "nexus deploy git [--remote origin] [--branch main]",
      run: gitDeploy,
    },
  ],
}

export default plugin

export * as DeployPlugin from "./deploy"
