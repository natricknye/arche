export function parseDuration(input: string): number {
  const units: Record<string, number> = { h: 3600, m: 60, s: 1 }
  let total = 0

  for (const match of input.matchAll(/(\d+)([hms])/g)) {
    total += Number(match[1]) * units[match[2]]
  }

  return total
}
