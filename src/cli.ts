import { parseArgs } from 'node:util'
import { crawl } from './crawl.ts'
import { chunk } from './extract.ts'
import { embed } from './embed.ts'
import { insert, rpc } from './db.ts'
import { slugify, savePages, loadPages } from './store.ts'

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    depth: { type: 'string', default: '2' },
    'max-pages': { type: 'string', default: '50' },
    timeout: { type: 'string', default: '10000' },
    name: { type: 'string' },
  },
})

const [command, domain] = positionals
if (!command || !domain) {
  console.error('использование: node src/cli.ts <crawl|ingest|publish|demo> <домен> [--depth 2] [--max-pages 50] [--name "Имя"]')
  process.exit(1)
}

const slug = slugify(domain)
const origin = domain.includes('://') ? domain : `https://${domain}`

async function doCrawl(): Promise<void> {
  console.log(`обход ${origin} (глубина ${values.depth}, потолок ${values['max-pages']})`)
  const pages = await crawl(origin, {
    depth: Number(values.depth),
    maxPages: Number(values['max-pages']),
    timeoutMs: Number(values.timeout),
  })
  if (pages.length === 0) throw new Error('не собрано ни одной страницы — проверь домен и robots.txt')
  await savePages(slug, pages)
  console.log(`собрано страниц: ${pages.length} → data/${slug}/raw/`)
}

async function doIngest(): Promise<void> {
  const pages = await loadPages(slug)
  console.log(`страниц на диске: ${pages.length}`)

  const leadRows = await rpc<{ id: string }[]>('upsert_lead', {
    p_slug: slug,
    p_name: values.name ?? slug,
    p_site_url: origin,
  })
  const leadId = leadRows[0].id

  let total = 0
  for (const page of pages) {
    const pageRows = await rpc<{ id: string }[]>('upsert_page', {
      p_lead_id: leadId,
      p_url: page.url,
      p_title: page.title,
      p_char_count: page.text.length,
    })
    const pageId = pageRows[0].id
    const parts = chunk(page.text)

    for (let i = 0; i < parts.length; i += 50) {
      const batch = parts.slice(i, i + 50)
      const vectors = await embed(batch, 'RETRIEVAL_DOCUMENT')
      await insert(
        'chunks',
        batch.map((text, j) => ({
          lead_id: leadId,
          page_id: pageId,
          ord: i + j,
          text,
          embedding: JSON.stringify(vectors[j]),
        })),
      )
      total += batch.length
      process.stdout.write(`\r  чанков: ${total}`)
      await new Promise((r) => setTimeout(r, 1000)) // ponytail: пауза под RPM free tier
    }
  }
  console.log(`\nпроиндексировано чанков: ${total}`)
}

const commands: Record<string, () => Promise<void>> = { crawl: doCrawl, ingest: doIngest }
const run = commands[command]
if (!run) {
  console.error(`неизвестная команда: ${command}`)
  process.exit(1)
}
await run()
