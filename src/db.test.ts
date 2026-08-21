import { test } from 'node:test'
import assert from 'node:assert/strict'
import { restUrl, rpc } from './db.ts'

test('склеивает адрес RPC', () => {
  assert.equal(
    restUrl('https://abc.supabase.co', 'rpc/match_chunks'),
    'https://abc.supabase.co/rest/v1/rpc/match_chunks',
  )
})

test('лишний слэш в конце базы не ломает адрес', () => {
  assert.equal(
    restUrl('https://abc.supabase.co/', 'rpc/get_lead_page'),
    'https://abc.supabase.co/rest/v1/rpc/get_lead_page',
  )
})

test('пустой ответ 204 не превращается в SyntaxError', async () => {
  // log_question returns void: PostgREST отвечает 204 без тела.
  const original = globalThis.fetch
  // @ts-expect-error — подмена на время теста
  globalThis.fetch = async () => new Response(null, { status: 204 })
  try {
    const out = await rpc('log_question', {}, { url: 'https://x.supabase.co', key: 'k' })
    assert.equal(out, null)
  } finally {
    globalThis.fetch = original
  }
})
