import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseRobots, isAllowed } from './robots.ts'

test('берёт Disallow для *', () => {
  const txt = 'User-agent: *\nDisallow: /admin\nDisallow: /cart\n'
  assert.deepEqual(parseRobots(txt), ['/admin', '/cart'])
})

test('игнорирует правила чужого агента', () => {
  const txt = 'User-agent: BadBot\nDisallow: /\n\nUser-agent: *\nDisallow: /admin\n'
  assert.deepEqual(parseRobots(txt), ['/admin'])
})

test('пустой Disallow ничего не запрещает', () => {
  assert.deepEqual(parseRobots('User-agent: *\nDisallow:\n'), [])
})

test('регистр директив не важен, комментарии отбрасываются', () => {
  const txt = 'user-agent: *\ndisallow: /admin # внутренняя зона\n'
  assert.deepEqual(parseRobots(txt), ['/admin'])
})

test('isAllowed режет по префиксу', () => {
  const d = ['/admin']
  assert.equal(isAllowed(d, '/admin/users'), false)
  assert.equal(isAllowed(d, '/administrative'), false)
  assert.equal(isAllowed(d, '/about'), true)
})

test('пустой robots.txt разрешает всё', () => {
  assert.equal(isAllowed(parseRobots(''), '/anything'), true)
})

test('правило с маской и якорем реально запрещает путь', () => {
  const d = ['/*.php$']
  assert.equal(isAllowed(d, '/index.php'), false)
  assert.equal(isAllowed(d, '/a/b/index.php'), false)
  assert.equal(isAllowed(d, '/index.php?x=1'), true, 'якорь $ — конец пути')
  assert.equal(isAllowed(d, '/about'), true)
})

test('маска в середине правила раскрывается', () => {
  assert.equal(isAllowed(['/private*/secret'], '/private-2026/secret'), false)
  assert.equal(isAllowed(['/private*/secret'], '/public/secret'), true)
})
