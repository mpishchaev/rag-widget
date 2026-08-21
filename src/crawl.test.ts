import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { normalizeLink, crawl } from './crawl.ts'

const base = new URL('https://example.com/about')

test('относительная ссылка становится абсолютной', () => {
  assert.equal(normalizeLink(base, '/contacts'), 'https://example.com/contacts')
})

test('чужой хост отбрасывается', () => {
  assert.equal(normalizeLink(base, 'https://facebook.com/x'), null)
})

test('поддомен — чужой хост', () => {
  assert.equal(normalizeLink(base, 'https://blog.example.com/x'), null)
})

test('фрагмент отбрасывается, ссылка на ту же страницу схлопывается', () => {
  assert.equal(normalizeLink(base, '/about#team'), 'https://example.com/about')
})

test('mailto, tel и javascript отбрасываются', () => {
  assert.equal(normalizeLink(base, 'mailto:a@b.c'), null)
  assert.equal(normalizeLink(base, 'tel:+123'), null)
  assert.equal(normalizeLink(base, 'javascript:void(0)'), null)
})

test('файлы-непострaницы отбрасываются', () => {
  assert.equal(normalizeLink(base, '/doc.pdf'), null)
  assert.equal(normalizeLink(base, '/img.png'), null)
})

test('битая ссылка не роняет разбор', () => {
  assert.equal(normalizeLink(base, '://///'), null)
})

test('ссылка с абсолютным URL в query-строке остаётся тем же хостом', () => {
  assert.equal(
    normalizeLink(base, '/redirect?url=https://evil.com'),
    'https://example.com/redirect?url=https://evil.com',
  )
})

test('robots.txt отдаётся как text/plain и реально запрещает страницы', async () => {
  const server = createServer((req, res) => {
    if (req.url === '/robots.txt') {
      res.writeHead(200, { 'content-type': 'text/plain' })
      res.end('User-agent: *\nDisallow: /private\n')
    } else if (req.url === '/') {
      res.writeHead(200, { 'content-type': 'text/html' })
      res.end('<html><body><a href="/public">public</a> <a href="/private">private</a></body></html>')
    } else if (req.url === '/public') {
      res.writeHead(200, { 'content-type': 'text/html' })
      res.end('<html><body>публичная страница с осмысленным текстом для обхода</body></html>')
    } else if (req.url === '/private') {
      res.writeHead(200, { 'content-type': 'text/html' })
      res.end('<html><body>приватная страница, которую нельзя обходить по robots.txt</body></html>')
    } else {
      res.writeHead(404)
      res.end()
    }
  })
  await new Promise((resolve) => server.listen(0, resolve))
  const { port } = server.address()
  try {
    const pages = await crawl(`http://127.0.0.1:${port}`, { depth: 1, maxPages: 10, timeoutMs: 5000 })
    const urls = pages.map((p) => p.url)
    assert.ok(urls.some((u) => u.endsWith('/public')), 'ожидалась публичная страница')
    assert.ok(!urls.some((u) => u.endsWith('/private')), 'приватная страница должна быть запрещена robots.txt')
  } finally {
    await new Promise((resolve) => server.close(resolve))
  }
})
