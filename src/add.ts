import { mkdir, writeFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import { extractText } from './extract.ts'
import { leadDir } from './store.ts'
import type { Page } from './crawl.ts'

/** Префикс ручных источников: своё пространство имён, чтобы повторный обход
 * (он пишет `crawl-NNN.json` и убирает только свои файлы) их не затирал. */
export const ADD_PREFIX = 'add-'

/**
 * Дописывает в существующую папку, не затирая уже собранное обходом.
 * Файлы обхода (`crawl-*`) в нумерации не участвуют. Голые `NNN.json` считаются
 * тоже — это раскладка прошлых запусков, папку с ней перезаписывать нельзя.
 */
export function nextIndex(existing: string[]): number {
  const nums = existing
    .map((f) => /^(?:add-)?(\d+)\.json$/.exec(f))
    .filter((m) => m !== null)
    .map((m) => Number(m[1]))
  return nums.length === 0 ? 0 : Math.max(...nums) + 1
}

export async function fetchAsPage(url: string, timeoutMs: number): Promise<Page> {
  const res = await fetch(url, {
    signal: AbortSignal.timeout(timeoutMs),
    headers: { 'user-agent': 'rag-widget-demo (+https://coadvise.co)' },
  })
  if (!res.ok) throw new Error(`${url} ответил ${res.status}`)
  if (!(res.headers.get('content-type') ?? '').includes('text/html')) {
    throw new Error(`${url}: content-type не text/html — похоже на не-страницу`)
  }
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

/**
 * Кладёт одну страницу рядом с уже собранными.
 *
 * ponytail: readdir→writeFile — не одна атомарная операция, поэтому индекс
 * берётся под 'wx' (эксклюзивное создание, падает на EEXIST) и на конфликте
 * пересчитывается заново, с ограниченным числом попыток. Потолок — это не
 * блокировка: параллельных писателей больше, чем ATTEMPTS, всё ещё может
 * не хватить попыток; апгрейд — файловый лок (proper-lockfile) или счётчик
 * в отдельном файле, если параллельных операторов на одного лида станет
 * больше одного.
 */
export async function appendPage(slug: string, page: Page): Promise<string> {
  const dir = join(leadDir(slug), 'raw')
  await mkdir(dir, { recursive: true })
  const ATTEMPTS = 20
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    const files = await readdir(dir).catch(() => [] as string[])
    const name = `${ADD_PREFIX}${String(nextIndex(files)).padStart(3, '0')}.json`
    try {
      await writeFile(join(dir, name), JSON.stringify(page, null, 2), { flag: 'wx' })
      return name
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== 'EEXIST') throw err
    }
  }
  throw new Error(`appendPage: не удалось найти свободный номер за ${ATTEMPTS} попыток`)
}
