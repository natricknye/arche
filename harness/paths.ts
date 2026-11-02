export type Scope = "task" | "self"

const mutableDirectories = ["agent/", "prompts/", "tools/", "docs/"]
const mutableFiles = ["README.md", "DESIGN.md"]

export function changedPaths(patch: string): string[] {
  const paths = new Set<string>()

  for (const line of patch.split(/\r?\n/)) {
    if (line.startsWith("diff --git ")) {
      const match = line.match(/^diff --git a\/(.+) b\/(.+)$/)
      if (!match) continue
      paths.add(match[1])
      paths.add(match[2])
      continue
    }

    if (line.startsWith("--- ")) {
      const path = line.slice(4).trim()
      if (path !== "/dev/null") paths.add(path.replace(/^a\//, ""))
      continue
    }

    if (line.startsWith("+++ ")) {
      const path = line.slice(4).trim()
      if (path !== "/dev/null") paths.add(path.replace(/^b\//, ""))
    }
  }

  return [...paths]
}

export function validate(paths: string[], scope: Scope): { ok: true } | { ok: false; reason: string } {
  for (const raw of paths) {
    const path = raw.replaceAll("\\", "/")

    if (path.startsWith("/") || /^[a-zA-Z]:/.test(path)) {
      return { ok: false, reason: `absolute path: ${path}` }
    }

    if (path.split("/").includes("..")) {
      return { ok: false, reason: `parent segment: ${path}` }
    }

    if (scope === "task") continue

    if (mutableDirectories.some((prefix) => path.startsWith(prefix))) continue
    if (mutableFiles.includes(path)) continue

    return { ok: false, reason: `outside mutable scope: ${path}` }
  }

  return { ok: true }
}
