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

/**
 * Правило robots.txt в регулярку: `*` — любая подстрока, завершающий `$` — конец
 * пути. Без этого `Disallow: /*.php$` сравнивался бы как префикс `/*` и не
 * совпадал ни с чем — запрещённые страницы уходили бы в обход.
 *
 * ponytail: `Allow:` не разбирается вовсе, приоритет самого длинного правила из
 * спецификации не реализован. Потолок — сайт с `Disallow: /` + `Allow: /public`
 * будет пропущен целиком; ошибка в безопасную сторону (не обходим лишнего).
 * Апгрейд — разбирать Allow и сравнивать по длине совпавшего правила.
 */
function ruleToRegExp(rule: string): RegExp {
  const anchored = rule.endsWith('$')
  const body = (anchored ? rule.slice(0, -1) : rule)
    .replace(/[.+?^${}()|[\]\\]/g, '\\$&')
    .replace(/\*/g, '.*')
  return new RegExp(`^${body}${anchored ? '$' : ''}`)
}

export function isAllowed(disallows: string[], pathname: string): boolean {
  return !disallows.some((d) => ruleToRegExp(d).test(pathname))
}
