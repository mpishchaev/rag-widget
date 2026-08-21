import { test } from 'node:test'
import assert from 'node:assert/strict'
import { normalize, DIMENSIONS } from './embed.ts'

test('размерность зафиксирована на 768', () => {
  assert.equal(DIMENSIONS, 768)
})

test('нормализованный вектор имеет длину 1', () => {
  const v = normalize([3, 4])
  assert.ok(Math.abs(Math.hypot(...v) - 1) < 1e-9, `длина ${Math.hypot(...v)}`)
  assert.ok(Math.abs(v[0] - 0.6) < 1e-9)
  assert.ok(Math.abs(v[1] - 0.8) < 1e-9)
})

test('уже нормализованный вектор не меняется', () => {
  const v = normalize([1, 0, 0])
  assert.deepEqual(v, [1, 0, 0])
})

test('нулевой вектор не даёт NaN', () => {
  const v = normalize([0, 0, 0])
  assert.ok(v.every((x) => Number.isFinite(x)), `получили ${v}`)
})
