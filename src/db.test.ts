import { test } from 'node:test'
import assert from 'node:assert/strict'
import { restUrl } from './db.ts'

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
