import { load } from 'cheerio'
import { parseRobots, isAllowed } from './robots.ts'
import { extractText } from './extract.ts'

export type CrawlOptions = { depth: number; maxPages: number; timeoutMs: number }
export type Page = { url: string; title: string; text: string }

const SKIP_EXT = /\.(pdf|png|jpe?g|gif|svg|webp|zip|mp4|mp3|css|js|ico|woff2?)$/i

export function normalizeLink(base: URL, href: string): string | null {
  // ponytail: WHATWG URL silently resolves a malformed absolute-looking href
  // (e.g. '://///') as a relative path instead of throwing. Guard by requiring
  // it to parse on its own first when it contains a scheme separator. Потолок —
  // only catches hrefs with '://' in them; апгрейд — validate with a stricter
  // URL grammar if more malformed shapes turn up.
  if (href.includes('://')) {
    try {
      new URL(href)
    } catch {
      return null
    }
  }
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

async function get(url: string, timeoutMs: number): Promise<string | null> {
  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(timeoutMs),
      headers: { 'user-agent': 'rag-widget-demo (+https://coadvise.co)' },
    })
    if (!res.ok) return null
    if (!(res.headers.get('content-type') ?? '').includes('text/html')) return null
    return await res.text()
  } catch {
    return null
  }
}

/** Обход в ширину с тремя обязательными ограничителями. Уважает robots.txt. */
export async function crawl(origin: string, opts: CrawlOptions): Promise<Page[]> {
  const start = new URL(origin)
  const robotsTxt = await get(new URL('/robots.txt', start).toString(), opts.timeoutMs)
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
