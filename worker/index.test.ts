import { test } from 'node:test'
import assert from 'node:assert/strict'
import worker from './index.ts'

const env = {
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_PUBLISHABLE_KEY: 'pub-key',
  GEMINI_API_KEY: 'gem-key',
}

/** Подменяет global.fetch маршрутизатором по URL и восстанавливает исходный после теста. */
function withFetch<T>(router: (url: string, init?: RequestInit) => Promise<Response> | Response, run: () => Promise<T>): Promise<T> {
  const original = globalThis.fetch
  // @ts-expect-error — подмена на время теста
  globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => router(String(input), init)
  return run().finally(() => {
    globalThis.fetch = original
  })
}

test('падающий log_question не отбрасывает уже посчитанный ответ', async () => {
  const html = await withFetch(async (url) => {
    if (url.includes('rpc/session_count')) return Response.json(0)
    if (url.includes('rpc/match_chunks')) return Response.json([{ text: 't', url: 'https://x.com/a', similarity: 0.9 }])
    if (url.includes('batchEmbedContents')) return Response.json({ embeddings: [{ values: Array(768).fill(0.1) }] })
    if (url.includes('generateContent')) {
      return Response.json({ candidates: [{ content: { parts: [{ text: 'Настоящий ответ' }] } }] })
    }
    if (url.includes('rpc/log_question')) return new Response('db error', { status: 500 })
    throw new Error('неожиданный URL: ' + url)
  }, async () => {
    const req = new Request('https://w.example/d/1234567890123456/ask', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question: 'Вопрос?', session: 'sess-1' }),
    })
    const res = await worker.fetch(req, env)
    assert.equal(res.status, 200)
    return res.json()
  })
  assert.equal(html.answer, 'Настоящий ответ')
})

test('падающий get_lead_page отдаёт общий текст, а не тело ошибки БД', async () => {
  const res = await withFetch(async (url) => {
    if (url.includes('rpc/get_lead_page')) return new Response('внутренние детали БД', { status: 500 })
    throw new Error('неожиданный URL: ' + url)
  }, async () => {
    const req = new Request('https://w.example/d/1234567890123456', { method: 'GET' })
    return worker.fetch(req, env)
  })
  assert.notEqual(res.status, 200)
  const text = await res.text()
  assert.doesNotMatch(text, /внутренние детали БД/)
})

test('POST на страницу (без /ask) не отдаёт HTML', async () => {
  const req = new Request('https://w.example/d/1234567890123456', { method: 'POST' })
  const res = await worker.fetch(req, env)
  assert.equal(res.status, 405)
})

test('429 от эмбеддинга даёт JSON с просьбой повторить, а не падение обработчика', async () => {
  const res = await withFetch(async (url) => {
    if (url.includes('rpc/session_count')) return Response.json(0)
    if (url.includes('batchEmbedContents')) return new Response('quota exceeded', { status: 429 })
    throw new Error('неожиданный URL: ' + url)
  }, async () => {
    const req = new Request('https://w.example/d/1234567890123456/ask', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question: 'Вопрос?', session: 'sess-1' }),
    })
    return worker.fetch(req, env)
  })
  assert.equal(res.headers.get('content-type'), 'application/json; charset=utf-8')
  const data = await res.json() as { answer: string }
  assert.match(data.answer, /ещё раз|позже/i)
  assert.doesNotMatch(data.answer, /quota exceeded/)
})
