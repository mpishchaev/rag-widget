import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalizeLink } from './crawl.ts'

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
