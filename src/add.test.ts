import { test } from 'node:test'
import assert from 'node:assert/strict'
import { nextIndex, manualPage } from './add.ts'

test('следующий номер идёт за максимальным', () => {
  assert.equal(nextIndex(['000.json', '001.json', '002.json']), 3)
})

test('пустая папка начинается с нуля', () => {
  assert.equal(nextIndex([]), 0)
})

test('дырки в нумерации не приводят к перезаписи', () => {
  assert.equal(nextIndex(['000.json', '007.json']), 8)
})

test('посторонние файлы игнорируются', () => {
  assert.equal(nextIndex(['000.json', 'notes.txt', '.DS_Store']), 1)
})

test('ручной текст становится страницей с меткой вместо url', () => {
  const p = manualPage('  Мы открыли третий цех.  ', 'linkedin-пост')
  assert.equal(p.url, 'manual:linkedin-пост')
  assert.equal(p.text, 'Мы открыли третий цех.')
  assert.equal(p.title, 'linkedin-пост')
})

test('пустой ручной текст отвергается', () => {
  assert.throws(() => manualPage('   ', 'метка'), /пуст/)
})
