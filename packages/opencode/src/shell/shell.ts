import { Flag } from "../flag/flag"
import { lazy } from "../util/lazy"
import path from "path"

const SIGKILL_TIMEOUT_MS = 200

export namespace Shell {
  type KillableProcess = { pid?: number | null; kill(signal?: NodeJS.Signals | number): void }

  export async function killTree(proc: KillableProcess, opts?: { exited?: () => boolean }): Promise<void> {
    const pid = proc.pid
    if (!pid || opts?.exited?.()) return

    if (process.platform === "win32") {
      try {
        await Bun.spawn(["taskkill", "/pid", String(pid), "/f", "/t"], {
          stdio: ["ignore", "ignore", "ignore"],
        }).exited
      } catch {}
      return
    }

    try {
      process.kill(-pid, "SIGTERM")
      await Bun.sleep(SIGKILL_TIMEOUT_MS)
      if (!opts?.exited?.()) {
        process.kill(-pid, "SIGKILL")
      }
    } catch (_e) {
      proc.kill("SIGTERM")
      await Bun.sleep(SIGKILL_TIMEOUT_MS)
      if (!opts?.exited?.()) {
        proc.kill("SIGKILL")
      }
    }
  }
  const BLACKLIST = new Set(["fish", "nu"])

  function fallback() {
    if (process.platform === "win32") {
      if (Flag.OPENCODE_GIT_BASH_PATH) return Flag.OPENCODE_GIT_BASH_PATH
      const git = Bun.which("git")
      if (git) {
        // git.exe is typically at: C:\Program Files\Git\cmd\git.exe
        // bash.exe is at: C:\Program Files\Git\bin\bash.exe
        const bash = path.join(git, "..", "..", "bin", "bash.exe")
        if (Bun.file(bash).size) return bash
      }
      return process.env.COMSPEC || "cmd.exe"
    }
    if (process.platform === "darwin") return "/bin/zsh"
    const bash = Bun.which("bash")
    if (bash) return bash
    return "/bin/sh"
  }

  export const preferred = lazy(() => {
    const s = process.env.SHELL
    if (s) return s
    return fallback()
  })

  export const acceptable = lazy(() => {
    const s = process.env.SHELL
    if (s && !BLACKLIST.has(process.platform === "win32" ? path.win32.basename(s) : path.basename(s))) return s
    return fallback()
  })

  export function commandArgs(shell: string, command: string): string[] {
    const shellName = (process.platform === "win32" ? path.win32.basename(shell, ".exe") : path.basename(shell))
      .toLowerCase()

    const invocations: Record<string, { args: string[] }> = {
      nu: {
        args: ["-c", command],
      },
      fish: {
        args: ["-c", command],
      },
      zsh: {
        args: [
          "-l",
          "-c",
          `
            [[ -f ~/.zshenv ]] && source ~/.zshenv >/dev/null 2>&1 || true
            [[ -f "\${ZDOTDIR:-$HOME}/.zshrc" ]] && source "\${ZDOTDIR:-$HOME}/.zshrc" >/dev/null 2>&1 || true
            ${command}
          `,
        ],
      },
      bash: {
        args: [
          "-l",
          "-c",
          `
            shopt -s expand_aliases
            [[ -f ~/.bashrc ]] && source ~/.bashrc >/dev/null 2>&1 || true
            ${command}
          `,
        ],
      },
      // Windows cmd
      cmd: {
        args: ["/c", command],
      },
      // Windows PowerShell
      powershell: {
        args: ["-NoProfile", "-Command", command],
      },
      pwsh: {
        args: ["-NoProfile", "-Command", command],
      },
      // Fallback: any shell that doesn't match those above
      //  - No -l, for max compatibility
      "": {
        args: ["-c", `${command}`],
      },
    }

    return (invocations[shellName] ?? invocations[""]).args
  }
}
