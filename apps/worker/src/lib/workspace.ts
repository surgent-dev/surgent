import path from "path";

const posix = path.posix;

export function localWorkspacePath(projectId: string): string {
  return posix.join("/home/user/workspace", projectId.replace(/[^a-zA-Z0-9_-]+/g, "-") || "project");
}


