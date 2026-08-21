/** Разбирает robots.txt и возвращает Disallow-префиксы для указанного агента. */
export function parseRobots(txt: string, ua = '*'): string[] {
  const disallows: string[] = []
  let active = false
  for (const raw of txt.split('\n')) {
    const line = raw.split('#')[0].trim()
    if (!line) continue
    const idx = line.indexOf(':')
    if (idx < 0) continue
    const key = line.slice(0, idx).trim().toLowerCase()
    const value = line.slice(idx + 1).trim()
    if (key === 'user-agent') {
      active = value === ua
    } else if (key === 'disallow' && active && value) {
      disallows.push(value)
    }
  }
  return disallows
}

export function isAllowed(disallows: string[], pathname: string): boolean {
  return !disallows.some((d) => pathname.startsWith(d))
}
