import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderPage, escapeHtml } from './page.ts'

test('имя лида экранируется — это тоже недоверенный ввод', () => {
  assert.equal(escapeHtml('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;')
  assert.equal(escapeHtml('Иванов & Ко "Мастер"'), 'Иванов &amp; Ко &quot;Мастер&quot;')
})

test('страница содержит имя, ссылку на сайт и стартовые вопросы', () => {
  const html = renderPage(
    { name: 'Мастерская', site_url: 'https://x.com', starter_questions: ['Что вы делаете?', 'Где вы?'] },
    'ключ123',
  )
  assert.match(html, /Мастерская/)
  assert.match(html, /https:\/\/x\.com/)
  assert.match(html, /Что вы делаете\?/)
  assert.match(html, /Где вы\?/)
  assert.match(html, /ключ123/, 'ключ нужен клиенту для запроса к /ask')
})

test('имя со скриптом не превращается в разметку', () => {
  const html = renderPage(
    { name: '<img src=x onerror=alert(1)>', site_url: 'https://x.com', starter_questions: [] },
    'k',
  )
  assert.doesNotMatch(html, /<img src=x/)
})

test('стартовые вопросы тоже экранируются', () => {
  const html = renderPage(
    { name: 'X', site_url: 'https://x.com', starter_questions: ['</button><script>bad()</script>'] },
    'k',
  )
  assert.doesNotMatch(html, /<script>bad\(\)/)
})
