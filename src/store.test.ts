import { test } from 'node:test'
import assert from 'node:assert/strict'
import { rm } from 'node:fs/promises'
import { join } from 'node:path'
import { slugify, savePages, loadPages, leadDir } from './store.ts'
import { appendPage, manualPage } from './add.ts'

test('домен превращается в безопасное имя папки', () => {
  assert.equal(slugify('https://www.example.com/'), 'example-com')
  assert.equal(slugify('example.com'), 'example-com')
  assert.equal(slugify('https://sub.example.co.uk/path'), 'sub-example-co-uk')
})

test('в имени не остаётся символов пути', () => {
  const s = slugify('https://example.com/a/b')
  assert.doesNotMatch(s, /[\/\\.:]/)
})

test('повторный обход не затирает вручную добавленный источник', async () => {
  const slug = 'store-namespace-test'
  const dir = join(leadDir(slug), 'raw')
  await rm(dir, { recursive: true, force: true })
  try {
    const crawled = (n: number) =>
      Array.from({ length: n }, (_, i) => ({ url: `https://x.com/${i}`, title: `t${i}`, text: `страница ${i}` }))

    await savePages(slug, crawled(3))
    await appendPage(slug, manualPage('вставка оператора', 'вставка'))

    // сайт вырос: повторный обход собрал 4 страницы
    await savePages(slug, crawled(4))
    const texts = (await loadPages(slug)).map((p) => p.text).sort()
    assert.equal(texts.length, 5, 'ручной источник или страница обхода потерялись')
    assert.ok(texts.includes('вставка оператора'), 'ручной источник затёрт повторным обходом')

    // сайт сжался: старые файлы обхода не должны переиндексироваться как текущие
    await savePages(slug, crawled(2))
    const after = (await loadPages(slug)).map((p) => p.text).sort()
    assert.deepEqual(after, ['вставка оператора', 'страница 0', 'страница 1'].sort())
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})
