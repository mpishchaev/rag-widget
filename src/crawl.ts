import { load } from 'cheerio'
import { parseRobots, isAllowed } from './robots.ts'
import { extractText } from './extract.ts'

export type CrawlOptions = { depth: number; maxPages: number; timeoutMs: number }
export type Page = { url: string; title: string; text: string }

const SKIP_EXT = /\.(pdf|png|jpe?g|gif|svg|webp|zip|mp4|mp3|css|js|ico|woff2?)$/i

export function normalizeLink(base: URL, href: string): string | null {
  // ponytail: WHATWG URL silently resolves a malformed href that *starts*
  // with a bare scheme separator (e.g. '://///') as a relative path instead
  // of throwing, so the try/catch below never fires for that shape. Guarded
  // narrowly on the literal prefix so it does NOT trip on ordinary same-host
  // links whose query string happens to embed '://' (e.g. '/redirect?url=
  // https://x'), which resolve correctly against `base`. Потолок — only
  // catches hrefs starting with '://'; апгрейд — validate with a stricter
  // URL grammar if more malformed shapes turn up.
  if (href.startsWith('://')) return null
  let u: URL
  try {
    u = new URL(href, base)
  } catch {
    return null
  }
  if (u.protocol !== 'http:' && u.protocol !== 'https:') return null
  if (u.hostname !== base.hostname) return null
  if (SKIP_EXT.test(u.pathname)) return null
  u.hash = ''
  return u.toString()
}

async function get(url: string, timeoutMs: number, requireHtml = true): Promise<string | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'user-agent': 'rag-widget-demo (+https://coadvise.co)' },
    })
    if (!res.ok) return null
    if (requireHtml && !(res.headers.get('content-type') ?? '').includes('text/html')) return null
    return await res.text()
  } catch {
    return null
  }
}

/** Обход в ширину с тремя обязательными ограничителями. Уважает robots.txt. */
export async function crawl(origin: string, opts: CrawlOptions): Promise<Page[]> {
  const start = new URL(origin)
  // robots.txt is real servers' text/plain, not HTML — don't content-type-gate it.
  const robotsTxt = await get(new URL('/robots.txt', start).toString(), opts.timeoutMs, false)
  const disallows = robotsTxt ? parseRobots(robotsTxt) : []

  const seen = new Set<string>([start.toString()])
  let frontier = [start.toString()]
  const pages: Page[] = []

  for (let level = 0; level <= opts.depth && frontier.length > 0; level++) {
    const next: string[] = []
    for (const url of frontier) {
      if (pages.length >= opts.maxPages) return pages
      if (!isAllowed(disallows, new URL(url).pathname)) continue

      const html = await get(url, opts.timeoutMs)
      if (!html) continue

      const { title, text } = extractText(html)
      if (text.length > 0) pages.push({ url, title, text })
      console.log(`  ${pages.length}/${opts.maxPages} ${url}`)

      if (level === opts.depth) continue
      const $ = load(html)
      $('a[href]').each((_, el) => {
        const link = normalizeLink(new URL(url), $(el).attr('href') ?? '')
        if (link && !seen.has(link)) {
          seen.add(link)
          next.push(link)
        }
      })
    }
    frontier = next
  }
  return pages
}
