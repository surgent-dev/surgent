import { realpathSync } from "fs"
import { relative } from "path"

export namespace Filesystem {
  /**
   * On Windows, normalize a path to its canonical casing using the filesystem.
   * This is needed because paths are case-insensitive but tools may return
   * different casing than what we send them.
   */
  export function normalizePath(p: string): string {
    if (process.platform !== "win32") return p
    try {
      return realpathSync.native(p)
    } catch {
      return p
    }
  }
  export function overlaps(a: string, b: string) {
    const relA = relative(a, b)
    const relB = relative(b, a)
    return !relA || !relA.startsWith("..") || !relB || !relB.startsWith("..")
  }

  export function contains(parent: string, child: string) {
    return !relative(parent, child).startsWith("..")
  }

}
