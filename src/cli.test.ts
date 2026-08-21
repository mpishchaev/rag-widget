import { test } from 'node:test'
import assert from 'node:assert/strict'
import { requireAccessKey } from './cli.ts'

test('publish без найденного лида кидает понятную ошибку, а не TypeError', () => {
  assert.throws(
    () => requireAccessKey([], 'unknown-co'),
    (err: unknown) => err instanceof Error && /unknown-co/.test(err.message) && /ingest/.test(err.message),
  )
})

test('publish с найденным лидом возвращает access_key', () => {
  assert.equal(requireAccessKey([{ access_key: 'abc123' }], 'known-co'), 'abc123')
})
