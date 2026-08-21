import { parseArgs } from 'node:util'
import { crawl } from './crawl.ts'
import { chunk } from './extract.ts'
import { embed } from './embed.ts'
import { insert, rpc } from './db.ts'
import { slugify, savePages, loadPages } from './store.ts'
import { fetchAsPage, manualPage, appendPage } from './add.ts'
import { suggestStarters } from './starters.ts'

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    depth: { type: 'string', default: '2' },
    'max-pages': { type: 'string', default: '50' },
    timeout: { type: 'string', default: '10000' },
    name: { type: 'string' },
    url: { type: 'string' },
    label: { type: 'string' },
  },
})

const [command, domain] = positionals
if (!command || !domain) {
  console.error('использование: node src/cli.ts <crawl|ingest|publish|demo|add-url|add-text> <домен> [--depth 2] [--max-pages 50] [--name "Имя"] [--url <адрес>] [--label "Метка"]')
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

async function doAddUrl(): Promise<void> {
  if (!values.url) throw new Error('нужен --url <адрес>')
  const page = await fetchAsPage(values.url, Number(values.timeout))
  const file = await appendPage(slug, page)
  console.log(`добавлено: ${file} (${page.text.length} символов) — запусти ingest, чтобы попало в индекс`)
}

async function doAddText(): Promise<void> {
  const chunks: Buffer[] = []
  for await (const c of process.stdin) chunks.push(c as Buffer)
  const page = manualPage(Buffer.concat(chunks).toString('utf8'), values.label ?? 'вставка')
  const file = await appendPage(slug, page)
  console.log(`добавлено: ${file} (${page.text.length} символов) — запусти ingest, чтобы попало в индекс`)
}

async function doPublish(): Promise<void> {
  const pages = await loadPages(slug)
  const sample = pages.map((p) => p.text).join('\n\n').slice(0, 12000)
  const starters = await suggestStarters(sample)
  console.log('стартовые вопросы:', starters.length ? starters : '(не собрались, страница будет без карточек)')

  const rows = await rpc<{ access_key: string }[]>('set_starters', {
    p_slug: slug,
    p_questions: JSON.stringify(starters),
  })
  console.log(`\nссылка: https://coadvise.co/d/${rows[0].access_key}\n`)
}

async function doDemo(): Promise<void> {
  await doCrawl()
  await doIngest()
  await doPublish()
}

const commands: Record<string, () => Promise<void>> = {
  crawl: doCrawl, ingest: doIngest, publish: doPublish, demo: doDemo,
  'add-url': doAddUrl, 'add-text': doAddText,
}
const run = commands[command]
if (!run) {
  console.error(`неизвестная команда: ${command}`)
  process.exit(1)
}
await run()
