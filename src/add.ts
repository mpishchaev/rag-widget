import { mkdir, writeFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { extractText } from './extract.ts'
import { leadDir } from './store.ts'
import type { Page } from './crawl.ts'

/** Дописывает в существующую папку, не затирая уже собранное обходом. */
export function nextIndex(existing: string[]): number {
  const nums = existing
    .filter((f) => /^\d+\.json$/.test(f))
    .map((f) => Number(f.slice(0, -5)))
  return nums.length === 0 ? 0 : Math.max(...nums) + 1
}

export async function fetchAsPage(url: string, timeoutMs: number): Promise<Page> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: { 'user-agent': 'rag-widget-demo (+https://coadvise.co)' },
  })
  if (!res.ok) throw new Error(`${url} ответил ${res.status}`)
  const { title, text } = extractText(await res.text())
  if (!text) throw new Error(`${url}: не удалось извлечь текст`)
  return { url, title, text }
}

/** Ручная вставка: источник, который анонимно не забрать. */
export function manualPage(text: string, label: string): Page {
  const clean = text.replace(/\s+/g, ' ').trim()
  if (!clean) throw new Error('вставленный текст пуст')
  return { url: `manual:${label}`, title: label, text: clean }
}

/** Кладёт одну страницу рядом с уже собранными. */
export async function appendPage(slug: string, page: Page): Promise<string> {
  const dir = join(leadDir(slug), 'raw')
  await mkdir(dir, { recursive: true })
  const files = await readdir(dir).catch(() => [] as string[])
  const name = `${String(nextIndex(files)).padStart(3, '0')}.json`
  await writeFile(join(dir, name), JSON.stringify(page, null, 2))
  return name
}
