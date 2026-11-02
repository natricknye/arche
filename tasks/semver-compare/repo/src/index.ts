export function compare(a: string, b: string): -1 | 0 | 1 {
  return a.localeCompare(b) as -1 | 0 | 1
}
