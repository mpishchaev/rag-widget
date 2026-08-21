import { test } from 'node:test'
import assert from 'node:assert/strict'
import { slugify } from './store.ts'

test('домен превращается в безопасное имя папки', () => {
  assert.equal(slugify('https://www.example.com/'), 'example-com')
  assert.equal(slugify('example.com'), 'example-com')
  assert.equal(slugify('https://sub.example.co.uk/path'), 'sub-example-co-uk')
})

test('в имени не остаётся символов пути', () => {
  const s = slugify('https://example.com/a/b')
  assert.doesNotMatch(s, /[\/\\.:]/)
})
