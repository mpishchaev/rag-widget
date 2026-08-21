import { mkdir, readFile, writeFile, readdir } from 'node:fs/promises'
import { join } from 'node:path'
import type { Page } from './crawl.ts'

export function slugify(domain: string): string {
  const host = domain.includes('://') ? new URL(domain).hostname : domain.split('/')[0]
  return host.replace(/^www\./, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase()
}

export function leadDir(slug: string): string {
  return join('data', slug)
}

/** Сырой текст ложится файлами, чтобы перезапускать нарезку без повторного обхода. */
export async function savePages(slug: string, pages: Page[]): Promise<void> {
  const dir = join(leadDir(slug), 'raw')
  await mkdir(dir, { recursive: true })
  await Promise.all(
    pages.map((p, i) =>
      writeFile(join(dir, `${String(i).padStart(3, '0')}.json`), JSON.stringify(p, null, 2)),
    ),
  )
}

export async function loadPages(slug: string): Promise<Page[]> {
  const dir = join(leadDir(slug), 'raw')
  const files = (await readdir(dir)).filter((f) => f.endsWith('.json')).sort()
  return Promise.all(files.map(async (f) => JSON.parse(await readFile(join(dir, f), 'utf8'))))
}
