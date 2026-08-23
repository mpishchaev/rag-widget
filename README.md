# rag-widget

Демо RAG-ассистента по сайту компании: локальный CLI обходит домен, режет текст
на чанки, эмбеддит через Gemini и складывает в Supabase; Cloudflare Worker
отдаёт персональную страницу по адресу `/d/<слаг-домена>` и отвечает на вопросы
посетителя строго по материалам этого сайта.

Дизайн: `docs/superpowers/specs/2026-08-21-rag-widget-design.md`.

## Требования

- Node 24+ (`.ts` исполняется напрямую, шага сборки нет).
- Проект Supabase, ключ Google Gemini API, аккаунт Cloudflare с зоной под маршрут.
- Единственная рантайм-зависимость — `cheerio`: `npm ci`.

## Настройка

### 1. Схема базы

Открыть SQL Editor проекта Supabase, выполнить `db/schema.sql` целиком.
Скрипт идемпотентен: повторный запуск безопасен.

Проверка после применения: `select proname from pg_proc where proname in
('upsert_lead','match_chunks')` возвращает две строки.

### 2. Ключи локального конвейера

Создать файл `.dev.vars` в корне (он в `.gitignore`, в репозиторий не попадает —
репозиторий публичный):

```
SUPABASE_URL=https://<ref>.supabase.co
SUPABASE_SECRET_KEY=<секретный ключ проекта Supabase>
GEMINI_API_KEY=<ключ Google AI Studio>
```

`SUPABASE_SECRET_KEY` — ключ вида `sb_secret_…` из Project Settings → API Keys.
Он обходит RLS и живёт только на машине оператора: ни в Worker, ни в CI его нет.

### 3. Переменные Worker'а

В `wrangler.jsonc` заполнить `vars`:

- `SUPABASE_URL` — тот же адрес проекта;
- `SUPABASE_PUBLISHABLE_KEY` — публикуемый ключ `sb_publishable_…` из того же
  раздела. Не секрет: RLS закрывает таблицы, доступны только четыре RPC.

`GEMINI_API_KEY` в файл **не** пишется: он задаётся один раз как Worker Secret в
дашборде Cloudflare (Workers & Pages → rag-widget → Settings → Variables and
Secrets) и переживает выкаты.

### 4. Секреты CI

В GitHub repo secrets: `CLOUDFLARE_API_TOKEN` (права `Edit Cloudflare Workers`)
и `CLOUDFLARE_ACCOUNT_ID`.

## Разовая миграция сырых файлов

Обход раньше писал файлы как `000.json`, `001.json`; теперь — `crawl-NNN.json`
для обхода и `add-NNN.json` для догруженных вручную источников. Разделение
нужно, чтобы повторный обход не затирал вставленный руками текст.

Старые файлы новый обход **не удаляет** (отличить в них обход от ручной вставки
уже нельзя), а индексация читает их наравне со свежими — то есть страница,
исчезнувшая с сайта, останется в индексе навсегда, а уцелевшие продублируются.

Поэтому перед первым обходом после обновления удалите файлы старого формата:

```bash
rm -f data/*/raw/[0-9][0-9][0-9].json
```

Проверить, что осталось: `ls data/*/raw/` — имена должны начинаться с `crawl-`
или `add-`.

## Прогон одного лида

```bash
npm run demo -- example.com --name "Название компании"
```

`demo` — это `crawl` → `ingest` → `publish` подряд. Шаги доступны и по
отдельности:

```bash
npm run crawl   -- example.com --depth 2 --max-pages 50 --timeout 10000
npm run ingest  -- example.com --name "Название компании"
npm run publish -- example.com
```

`crawl` уважает `robots.txt` и кладёт сырые страницы в `data/<slug>/raw/`
файлами `crawl-NNN.json`; `ingest` перечитывает их с диска, поэтому нарезку и
индексацию можно перезапускать без повторного обхода.

`publish` собирает две вещи, которые видит адресат: стартовые вопросы и
факты-доказательства для блока «what I read» (каждый со ссылкой на страницу
лида, выдуманные адреса отбрасываются). Затем печатает ссылку вида
`https://coadvise.co/d/acme-co` — ключ переиспользуется при повторных прогонах,
уже отправленная ссылка не протухает.

Страница англоязычная и оформлена в стилях coadvise.co; ассистент отвечает на
языке заданного вопроса. Оформление под бренд лида не подбирается — страница
прямо говорит, что на реальной установке оно подгоняется.

Догрузка источников, которых нет в обходе (пишутся как `add-NNN.json` и
повторным обходом не затираются):

```bash
npm run add-url  -- example.com --url https://example.com/pdf-landing
npm run add-text -- example.com --label "письмо от лида" < note.txt
```

После любой догрузки нужен повторный `ingest`.

## Тесты

```bash
npm test
```

`node --test` по `src/**/*.test.ts` и `worker/**/*.test.ts`, без внешних
зависимостей и без сети.

## Выкат

Worker выкатывается только из CI: push в `main` запускает
`.github/workflows/deploy.yml` (`npm ci` → `npm test` → `wrangler deploy`).
Красный тест — выката нет. Локальный `wrangler` не требуется.
