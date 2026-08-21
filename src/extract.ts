import { load } from 'cheerio'

const NOISE = 'script, style, nav, footer, header, aside, noscript, iframe, svg, form'

export function extractText(html: string): { title: string; text: string } {
  const $ = load(html)
  const title = $('title').first().text().trim()
  $(NOISE).remove()
  const text = $('body').text().replace(/\s+/g, ' ').trim()
  return { title, text }
}

/**
 * Режет текст по границам слов на куски не длиннее `size` с нахлёстом `overlap`.
 * ponytail: нарезка по символам, а не по предложениям или токенам. Потолок —
 * фраза может разорваться на середине; апгрейд — резать по границам предложений
 * (Intl.Segmenter с granularity 'sentence').
 */
export function chunk(text: string, size = 800, overlap = 120): string[] {
  const words = text.trim().split(/\s+/).filter(Boolean)
  if (words.length === 0) return []

  const parts: string[] = []
  let current: string[] = []
  let length = 0

  for (const word of words) {
    const added = current.length === 0 ? word.length : length + 1 + word.length
    if (added > size && current.length > 0) {
      parts.push(current.join(' '))
      // отступаем назад на overlap символов, считая с конца
      const back: string[] = []
      let backLen = 0
      for (let i = current.length - 1; i >= 0; i--) {
        const next = backLen === 0 ? current[i].length : backLen + 1 + current[i].length
        if (next > overlap) break
        back.unshift(current[i])
        backLen = next
      }
      current = back
      length = backLen
    }
    current.push(word)
    length = current.length === 1 ? word.length : length + 1 + word.length
  }
  if (current.length > 0) parts.push(current.join(' '))
  return parts
}
