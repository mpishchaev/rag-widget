import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { readFile, readdir, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { nextIndex, manualPage, appendPage, fetchAsPage } from './add.ts'
import { leadDir } from './store.ts'

test('следующий номер идёт за максимальным', () => {
  assert.equal(nextIndex(['000.json', '001.json', '002.json']), 3)
})

test('пустая папка начинается с нуля', () => {
  assert.equal(nextIndex([]), 0)
})

test('дырки в нумерации не приводят к перезаписи', () => {
  assert.equal(nextIndex(['000.json', '007.json']), 8)
})

test('посторонние файлы игнорируются', () => {
  assert.equal(nextIndex(['000.json', 'notes.txt', '.DS_Store']), 1)
})

test('ручной текст становится страницей с меткой вместо url', () => {
  const p = manualPage('  Мы открыли третий цех.  ', 'linkedin-пост')
  assert.equal(p.url, 'manual:linkedin-пост')
  assert.equal(p.text, 'Мы открыли третий цех.')
  assert.equal(p.title, 'linkedin-пост')
})

test('пустой ручной текст отвергается', () => {
  assert.throws(() => manualPage('   ', 'метка'), /пуст/)
})

test('две параллельные записи не затирают друг друга', async () => {
  const slug = 'add-race-test'
  const dir = join(leadDir(slug), 'raw')
  await rm(dir, { recursive: true, force: true })
  try {
    const a = manualPage('первая страница', 'первая')
    const b = manualPage('вторая страница', 'вторая')
    const [nameA, nameB] = await Promise.all([appendPage(slug, a), appendPage(slug, b)])

    assert.notEqual(nameA, nameB)
    const files = await readdir(dir)
    assert.equal(files.length, 2)

    const contents = await Promise.all(files.map((f) => readFile(join(dir, f), 'utf8')))
    const texts = contents.map((c) => JSON.parse(c).text).sort()
    assert.deepEqual(texts, ['вторая страница', 'первая страница'].sort())
  } finally {
    await rm(dir, { recursive: true, force: true })
  }
})

test('нестраничный content-type отвергается явно', async () => {
  const server = createServer((_req, res) => {
    res.writeHead(200, { 'content-type': 'application/pdf' })
    res.end('%PDF-1.4 not actually html')
  })
  await new Promise<void>((resolve) => server.listen(0, resolve))
  const { port } = server.address() as { port: number }
  try {
    await assert.rejects(fetchAsPage(`http://127.0.0.1:${port}/`, 5000), /content-type|html/i)
  } finally {
    server.close()
  }
})
