import { test } from 'node:test'
import assert from 'node:assert/strict'
import { extractText, chunk } from './extract.ts'

test('выбрасывает навигацию, скрипты и стили', () => {
  const html = `
    <html><head><title>Про нас</title><style>body{color:red}</style></head>
    <body>
      <nav>Главная Контакты</nav>
      <main><p>Мы чиним станки с 1998 года.</p></main>
      <footer>© 2026</footer>
      <script>analytics()</script>
    </body></html>`
  const { title, text } = extractText(html)
  assert.equal(title, 'Про нас')
  assert.match(text, /чиним станки/)
  assert.doesNotMatch(text, /Главная|analytics|© 2026|color:red/)
})

test('схлопывает пробелы и переносы', () => {
  const { text } = extractText('<p>раз</p>\n\n\n<p>два</p>')
  assert.equal(text, 'раз два')
})

test('без title не падает', () => {
  assert.equal(extractText('<p>текст</p>').title, '')
})

test('короткий текст остаётся одним чанком', () => {
  assert.deepEqual(chunk('коротко', 800, 120), ['коротко'])
})

test('длинный текст режется с нахлёстом и ничего не теряет', () => {
  const text = Array.from({ length: 300 }, (_, i) => `сл${i}`).join(' ')
  const parts = chunk(text, 200, 50)
  assert.ok(parts.length > 1, 'должно быть больше одного чанка')
  for (const p of parts) assert.ok(p.length <= 200, `чанк длиннее лимита: ${p.length}`)
  // каждое слово исходника присутствует хотя бы в одном чанке
  const joined = parts.join(' ')
  for (const w of text.split(' ')) assert.ok(joined.includes(w), `потеряно слово ${w}`)
})

test('нахлёст реально перекрывает соседей', () => {
  const text = Array.from({ length: 300 }, (_, i) => `сл${i}`).join(' ')
  const parts = chunk(text, 200, 50)
  const tail = parts[0].slice(-20)
  assert.ok(parts[1].includes(tail.trim().split(' ').pop()!), 'второй чанк не подхватил хвост первого')
})

test('пустой вход даёт пустой список', () => {
  assert.deepEqual(chunk('   ', 800, 120), [])
})
