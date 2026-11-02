export function compare(a: string, b: string): -1 | 0 | 1 {
  const left = a.split(".").map(Number)
  const right = b.split(".").map(Number)

  for (let index = 0; index < 3; index++) {
    if (left[index] > right[index]) return 1
    if (left[index] < right[index]) return -1
  }

  return 0
}
