import { test } from 'node:test'
import assert from 'node:assert/strict'
import { renderPage, renderNotFound, escapeHtml, type Lead } from './page.ts'

const lead = (over: Partial<Lead> = {}): Lead => ({
  name: 'Precision Machine Works',
  site_url: 'https://precisionmachine.example.com',
  starter_questions: ['What materials do you machine?'],
  proof_facts: [{ text: 'Machining titanium since 1998', url: 'https://precisionmachine.example.com/about' }],
  pages_read: 47,
  ...over,
})

test('имя лида экранируется — это тоже недоверенный ввод', () => {
  assert.equal(escapeHtml('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;')
  assert.equal(escapeHtml('Иванов & Ко "Мастер"'), 'Иванов &amp; Ко &quot;Мастер&quot;')
})

test('страница несёт имя, сайт, стартовые вопросы и ключ', () => {
  const html = renderPage(lead(), 'precision-machine-works')
  assert.match(html, /Precision Machine Works/)
  assert.match(html, /https:\/\/precisionmachine\.example\.com/)
  assert.match(html, /What materials do you machine\?/)
  assert.match(html, /precision-machine-works/, 'ключ нужен клиенту для запроса к /ask')
})

test('страница на английском — язык объявлен и в разметке', () => {
  const html = renderPage(lead(), 'k')
  assert.match(html, /<html lang="en"/)
  assert.doesNotMatch(html.replace(/<!--[\s\S]*?-->/g, ''), /[а-яё]{4}/i, 'русский текст на странице лида')
})

test('факты выводятся со ссылкой на страницу-источник', () => {
  const html = renderPage(lead(), 'k')
  assert.match(html, /Machining titanium since 1998/)
  assert.match(html, /href="https:\/\/precisionmachine\.example\.com\/about"/)
})

test('число прочитанных страниц названо явно — это и есть доказательство', () => {
  assert.match(renderPage(lead({ pages_read: 47 }), 'k'), /47/)
})

test('фактов нет — блок исчезает, страница остаётся целой', () => {
  const html = renderPage(lead({ proof_facts: [] }), 'k')
  assert.doesNotMatch(html, /id="proof"/)
  assert.match(html, /Precision Machine Works/, 'остальная страница на месте')
})

test('битый proof_facts не роняет страницу', () => {
  for (const broken of ['[{"text":"x"}]', null, 42, [{ nope: 1 }], [{ text: 'ok', url: 5 }]]) {
    const html = renderPage(lead({ proof_facts: broken }), 'k')
    assert.match(html, /Precision Machine Works/)
    assert.doesNotMatch(html, /undefined/, 'битая запись не должна печататься как undefined')
  }
})

test('javascript: в ссылке факта не становится href', () => {
  const html = renderPage(
    lead({ proof_facts: [{ text: 'looks legit here', url: 'javascript:alert(1)' }] }),
    'k',
  )
  assert.doesNotMatch(html, /href="javascript:/)
})

test('разметка в факте не исполняется', () => {
  const html = renderPage(
    lead({ proof_facts: [{ text: '</a><script>bad()</script>', url: 'https://x.com' }] }),
    'k',
  )
  assert.doesNotMatch(html, /<script>bad\(\)/)
})

test('имя со скриптом не превращается в разметку', () => {
  assert.doesNotMatch(renderPage(lead({ name: '<img src=x onerror=alert(1)>' }), 'k'), /<img src=x/)
})

test('стартовые вопросы тоже экранируются', () => {
  const html = renderPage(lead({ starter_questions: ['</button><script>bad()</script>'] }), 'k')
  assert.doesNotMatch(html, /<script>bad\(\)/)
})

test('javascript: URL в site_url не становится href', () => {
  const html = renderPage(lead({ site_url: 'javascript:alert(document.cookie)' }), 'k')
  assert.doesNotMatch(html, /href="javascript:/)
})

test('нестроковый starter_questions не роняет страницу', () => {
  for (const broken of ['["What?"]', null, 7]) {
    const html = renderPage(lead({ starter_questions: broken }), 'k')
    assert.match(html, /Precision Machine Works/)
    assert.doesNotMatch(html, /class="q"/)
  }
})

test('страница закрыта от индексации — ссылки лидов не должны находиться поиском', () => {
  assert.match(renderPage(lead(), 'k'), /name="robots" content="noindex/)
})

test('404 зовёт написать письмом, а не сообщает об ошибке', () => {
  const html = renderNotFound()
  assert.match(html, /mailto:maxim@coadvise\.co/)
  assert.doesNotMatch(html, /Not found/i)
  assert.match(html, /<html lang="en"/)
})

test('404 не раскрывает, существует ли какой-либо лид', () => {
  const html = renderNotFound()
  assert.doesNotMatch(html, /Precision/)
  assert.doesNotMatch(html, /\/ask/, 'на 404 нет виджета — некого спрашивать')
})
