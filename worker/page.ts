import { MAX_QUESTION } from '../src/prompt.ts'

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const SAFE_URL_SCHEMES = ['http:', 'https:']

/**
 * site_url приходит из скрапа чужого сайта — недоверенный ввод. Без проверки схемы
 * значение вроде `javascript:alert(document.cookie)` пережило бы escapeHtml невредимым
 * и стало бы исполняемой ссылкой в href.
 */
function safeUrl(url: string): string {
  try {
    if (SAFE_URL_SCHEMES.includes(new URL(url).protocol)) return url
  } catch {
    // не URL вовсе — тоже отбрасываем
  }
  return '#'
}

// starter_questions приходит из jsonb: тип в базе не гарантирует массив (битая
// запись, скаляр вместо массива), поэтому здесь unknown, а не string[].
export type Lead = { name: string; site_url: string; starter_questions: unknown }

/** Один шаблон на всех: под лида меняется только подстановка. */
export function renderPage(lead: Lead, accessKey: string): string {
  const name = escapeHtml(lead.name)
  const site = escapeHtml(lead.site_url)
  const siteHref = escapeHtml(safeUrl(lead.site_url))
  // Битые данные деградируют до страницы без карточек: 500 у посетителя хуже,
  // чем страница без подсказок.
  const questions = Array.isArray(lead.starter_questions) ? lead.starter_questions : []
  const cards = questions
    .map((q) => `<button class="q" type="button">${escapeHtml(String(q))}</button>`)
    .join('\n')

  return `<!doctype html>
<html lang="ru">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Ассистент по сайту ${name}</title>
<style>
  :root { color-scheme: light dark; --bg: #fff; --fg: #111; --mut: #666; --line: #e5e5e5; --acc: #1a56db; }
  @media (prefers-color-scheme: dark) {
    :root { --bg: #14161a; --fg: #eceef1; --mut: #9aa0a6; --line: #2a2e35; --acc: #7aa2f7; }
  }
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--fg); font: 16px/1.55 system-ui, sans-serif; }
  .wrap { max-width: 720px; margin: 0 auto; padding: 24px 16px 40px; }
  h1 { font-size: 1.4rem; margin: 0 0 4px; }
  .sub { color: var(--mut); margin: 0 0 24px; font-size: .95rem; }
  .sub a { color: var(--acc); }
  .q { display: block; width: 100%; text-align: left; margin: 0 0 8px; padding: 12px 14px;
       border: 1px solid var(--line); border-radius: 10px; background: transparent;
       color: var(--fg); font: inherit; cursor: pointer; }
  .q:hover { border-color: var(--acc); }
  #log { margin: 20px 0; display: flex; flex-direction: column; gap: 14px; }
  .msg { padding: 12px 14px; border-radius: 10px; white-space: pre-wrap; overflow-wrap: anywhere; }
  .me { background: var(--acc); color: #fff; align-self: flex-end; max-width: 85%; }
  .bot { border: 1px solid var(--line); align-self: flex-start; max-width: 95%; }
  form { display: flex; gap: 8px; position: sticky; bottom: 0; background: var(--bg); padding: 12px 0; }
  input { flex: 1; padding: 12px 14px; border: 1px solid var(--line); border-radius: 10px;
          background: transparent; color: var(--fg); font: inherit; }
  button[type=submit] { padding: 12px 18px; border: 0; border-radius: 10px; background: var(--acc);
                        color: #fff; font: inherit; cursor: pointer; }
  footer { margin-top: 32px; padding-top: 16px; border-top: 1px solid var(--line);
           color: var(--mut); font-size: .875rem; }
  footer a { color: var(--acc); }
</style>
</head>
<body>
<div class="wrap">
  <h1>Ассистент по сайту ${name}</h1>
  <p class="sub">Отвечает только по материалам <a href="${siteHref}" rel="noopener noreferrer" target="_blank">${site}</a>. Каждый ответ со ссылкой на страницу — можно проверить.</p>
  <div id="starters">${cards}</div>
  <div id="log"></div>
  <form id="f"><input id="i" placeholder="Спросите что-нибудь про компанию" autocomplete="off" maxlength="${MAX_QUESTION}"><button type="submit">Спросить</button></form>
  <footer>Демо собрано по публичным страницам сайта. Вопросы — <a href="https://coadvise.co">coadvise.co</a>.</footer>
</div>
<script>
const KEY = ${JSON.stringify(accessKey)};
const log = document.getElementById('log');
const form = document.getElementById('f');
const input = document.getElementById('i');
let session = localStorage.getItem('sid');
if (!session) { session = crypto.randomUUID(); localStorage.setItem('sid', session); }

function add(text, who) {
  const d = document.createElement('div');
  d.className = 'msg ' + who;
  d.textContent = text;
  log.appendChild(d);
  d.scrollIntoView({ behavior: 'smooth', block: 'end' });
  return d;
}

async function ask(q) {
  document.getElementById('starters').remove?.();
  add(q, 'me');
  const pending = add('…', 'bot');
  try {
    const res = await fetch('/d/' + KEY + '/ask', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question: q, session }),
    });
    const data = await res.json();
    pending.textContent = data.answer ?? 'Не получилось ответить. Попробуйте ещё раз.';
  } catch {
    pending.textContent = 'Не получилось связаться с сервером. Попробуйте ещё раз.';
  }
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  const q = input.value.trim();
  if (!q) return;
  input.value = '';
  ask(q);
});
document.querySelectorAll('.q').forEach((b) => b.addEventListener('click', () => ask(b.textContent)));
</script>
</body>
</html>`
}
