export function compare(a: string, b: string): -1 | 0 | 1 {
  const left = Number(a.split(".")[0])
  const right = Number(b.split(".")[0])

  if (left > right) return 1
  if (left < right) return -1
  return 0
}
