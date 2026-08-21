import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseStarters } from './starters.ts'

test('берёт вопросы из нумерованного списка', () => {
  const raw = '1. Что вы производите?\n2. Где вы находитесь?\n3. Как заказать?'
  assert.deepEqual(parseStarters(raw), ['Что вы производите?', 'Где вы находитесь?', 'Как заказать?'])
})

test('берёт вопросы из списка с дефисами', () => {
  assert.deepEqual(parseStarters('- Первый?\n- Второй?'), ['Первый?', 'Второй?'])
})

test('отбрасывает строки без вопросительного знака', () => {
  assert.deepEqual(parseStarters('Вот вопросы:\n1. Реальный вопрос?\nПросто текст'), ['Реальный вопрос?'])
})

test('не больше четырёх', () => {
  const raw = Array.from({ length: 9 }, (_, i) => `${i + 1}. Вопрос ${i}?`).join('\n')
  assert.equal(parseStarters(raw).length, 4)
})

test('мусор на входе даёт пустой список, а не падение', () => {
  assert.deepEqual(parseStarters(''), [])
})
