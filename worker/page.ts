import { MAX_QUESTION } from '../src/prompt.ts'
import type { Fact } from '../src/proof.ts'

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const SAFE_URL_SCHEMES = ['http:', 'https:']

/**
 * site_url и адреса фактов приходят со скрапа чужого сайта — недоверенный ввод.
 * Без проверки схемы значение вроде `javascript:alert(document.cookie)` пережило
 * бы escapeHtml невредимым и стало бы исполняемой ссылкой в href.
 */
function safeUrl(url: string): string {
  try {
    if (SAFE_URL_SCHEMES.includes(new URL(url).protocol)) return url
  } catch {
    // не URL вовсе — тоже отбрасываем
  }
  return '#'
}

/** Хост без схемы и www — для строк вида «read straight from acme.co». */
function host(url: string): string {
  try {
    return new URL(url).host.replace(/^www\./, '')
  } catch {
    return url
  }
}

// starter_questions и proof_facts приходят из jsonb: тип в базе не гарантирует
// ни массив, ни форму элемента (битая запись, скаляр вместо массива), поэтому
// здесь unknown, а не string[] / Fact[].
export type Lead = {
  name: string
  site_url: string
  starter_questions: unknown
  proof_facts: unknown
  pages_read: number
}

/** Битые данные обязаны деградировать до страницы без блока, а не в 500. */
function asFacts(value: unknown): Fact[] {
  if (!Array.isArray(value)) return []
  return value.filter(
    (f): f is Fact =>
      typeof f === 'object' && f !== null &&
      typeof (f as Fact).text === 'string' && typeof (f as Fact).url === 'string',
  )
}

function asQuestions(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((q): q is string => typeof q === 'string') : []
}

const EMAIL = 'maxim@coadvise.co'
const MAILTO = `mailto:${EMAIL}?subject=Intro%20call`

// Токены — копия coadvise.co (Landings/Coadvise/src/styles/tokens.css). Сайт и
// демо живут в разных репозиториях, общего файла нет; расхождение стоит
// косметики, не работоспособности.
// ponytail: копия дрейфует при редизайне сайта. Апгрейд — положить tokens.css в
// public/ сайта и линковать по стабильному URL с того же домена.
const TOKENS = `
:root {
  --surface: oklch(0.992 0 0);
  --surface-2: oklch(0.972 0 0);
  --ink: oklch(0.26 0 0);
  --ink-strong: oklch(0.16 0 0);
  --ink-muted: oklch(0.46 0 0);
  --hairline: oklch(0.88 0 0);
  --hairline-strong: oklch(0.80 0 0);
  --accent: oklch(0.43 0.072 205);
  --accent-hover: oklch(0.36 0.075 205);
  --on-accent: oklch(0.99 0.004 205);
  --on-accent-muted: oklch(0.86 0.02 205);
  --accent-hairline: oklch(0.99 0.01 205 / 0.22);
  --focus: oklch(0.58 0.13 205);
  --font-sans: 'Hanken Grotesk', ui-sans-serif, system-ui, -apple-system, 'Segoe UI', sans-serif;
  --font-mono: ui-monospace, 'SF Mono', 'Cascadia Mono', 'Segoe UI Mono', Menlo, Consolas, monospace;
  --step-h1: clamp(2.35rem, 1.5rem + 3.6vw, 3.6rem);
  --step-h2: clamp(1.5rem, 1.18rem + 1.35vw, 2rem);
  --step-lede: clamp(1.35rem, 1.1rem + 1.15vw, 1.9rem);
  --step-lead: clamp(1.125rem, 1.04rem + 0.45vw, 1.3rem);
  --step-body: 1.125rem;
  --step-small: 0.95rem;
  --step-label: 0.78rem;
  --leading-tight: 1.1;
  --leading-body: 1.62;
  --shell: 62rem;
  --measure: 40rem;
  --gutter: clamp(1.25rem, 0.7rem + 2.6vw, 2.75rem);
  --section-gap: clamp(3.25rem, 2.2rem + 4.6vw, 5.75rem);
  --stack: clamp(1rem, 0.85rem + 0.6vw, 1.3rem);
  --rail: 9.5rem;
  --radius: 0.5rem;
  --shadow-cta: 0 1px 2px oklch(0.2 0 0 / 0.12), 0 6px 22px oklch(0.43 0.072 205 / 0.2);
  --z-nav: 100;
  --z-widget: 200;
}
*, *::before, *::after { box-sizing: border-box; }
html { -webkit-text-size-adjust: 100%; scroll-behavior: smooth; scroll-padding-top: 5.5rem; }
@media (prefers-reduced-motion: reduce) { html { scroll-behavior: auto; } }
body {
  margin: 0; background: var(--surface); color: var(--ink);
  font-family: var(--font-sans); font-size: var(--step-body);
  line-height: var(--leading-body); font-weight: 400;
  -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility;
}
h1, h2 {
  color: var(--ink-strong); line-height: var(--leading-tight);
  letter-spacing: -0.025em; text-wrap: balance; overflow-wrap: break-word; margin: 0;
}
h1 { font-size: var(--step-h1); }
h2 { font-size: var(--step-h2); }
p { text-wrap: pretty; margin: 0; }
a { color: inherit; text-decoration: none; }
:where(a, button):focus-visible { outline: 2px solid var(--focus); outline-offset: 3px; border-radius: 2px; }
::selection { background: oklch(0.43 0.072 205 / 0.16); }
.label {
  font-family: var(--font-mono); font-size: var(--step-label); font-weight: 500;
  letter-spacing: 0.08em; text-transform: uppercase; color: var(--ink-muted);
}
.spine {
  max-width: var(--shell); margin-inline: auto; padding-inline: var(--gutter);
  display: grid; grid-template-columns: var(--rail) minmax(0, 1fr);
  column-gap: clamp(1.5rem, 0.8rem + 2.4vw, 3rem);
}
.spine > .rail { position: sticky; top: 5.25rem; align-self: start; padding-top: 0.45rem; }
.spine > .body { max-width: var(--measure); }
@media (max-width: 46rem) {
  .spine { grid-template-columns: 1fr; row-gap: 0.85rem; }
  .spine > .rail { position: static; padding-top: 0; }
}
.btn-accent {
  display: inline-flex; align-items: center; gap: 0.55rem;
  background: var(--accent); color: var(--on-accent); font-weight: 600;
  font-size: 1.05rem; line-height: 1; padding: 0.85rem 1.4rem;
  border: 0; border-radius: var(--radius); box-shadow: var(--shadow-cta); cursor: pointer;
  font-family: inherit;
  transition: background 0.15s ease, transform 0.12s ease;
}
.btn-accent:hover { background: var(--accent-hover); color: var(--on-accent); transform: translateY(-1px); }
.btn-accent:active { transform: translateY(0); }
@media (prefers-reduced-motion: no-preference) {
  .rise { opacity: 0; transform: translateY(10px); animation: rise 0.62s cubic-bezier(0.22,1,0.36,1) forwards; animation-delay: var(--d, 0ms); }
}
@keyframes rise { to { opacity: 1; transform: none; } }
`

const PAGE_CSS = `
.nav { position: sticky; top: 0; z-index: var(--z-nav); background: var(--surface); border-bottom: 1px solid var(--hairline); }
.nav-inner {
  /* shell + gutters, so the wordmark lines up with the footer and the spine
     rail rather than sitting one gutter further in. */
  max-width: calc(var(--shell) + 2 * var(--gutter)); margin-inline: auto; padding: 0.95rem var(--gutter);
  display: flex; align-items: center; justify-content: space-between; gap: 1rem;
}
.wordmark { font-weight: 800; font-size: 1.2rem; letter-spacing: -0.03em; color: var(--ink-strong); }
.wordmark .dot { color: var(--accent); }
.nav .cta {
  color: var(--on-accent); background: var(--accent); padding: 0.5rem 0.95rem;
  border-radius: var(--radius); font-weight: 600; font-size: var(--step-small);
}
.nav .cta:hover { background: var(--accent-hover); }
.section { padding-block: var(--section-gap); }
.section + .section { border-top: 1px solid var(--hairline); }
.stack > * + * { margin-top: var(--stack); }
.lede { font-size: var(--step-lede); color: var(--ink-strong); letter-spacing: -0.015em; line-height: 1.25; }
.lead { font-size: var(--step-lead); }
.muted { color: var(--ink-muted); font-size: var(--step-small); }
.link { color: var(--accent); text-decoration: underline; text-underline-offset: 2px; text-decoration-thickness: 1px; }
.link:hover { color: var(--accent-hover); }

.facts { list-style: none; margin: 0; padding: 0; }
.facts li { padding-block: 0.9rem; border-top: 1px solid var(--hairline); }
.facts li:last-child { border-bottom: 1px solid var(--hairline); }
.facts .src { display: block; margin-top: 0.2rem; font-family: var(--font-mono); font-size: var(--step-label); color: var(--ink-muted); }
.facts .src:hover { color: var(--accent); }

.starters { display: flex; flex-wrap: wrap; gap: 0.6rem; }
.q {
  font: inherit; font-size: var(--step-small); text-align: left; color: var(--ink);
  background: var(--surface-2); border: 1px solid var(--hairline);
  border-radius: 999px; padding: 0.5rem 0.95rem; cursor: pointer;
  transition: border-color 0.15s ease, color 0.15s ease;
}
.q:hover { border-color: var(--accent); color: var(--accent); }

.fine { list-style: none; margin: 0; padding: 0; color: var(--ink-muted); font-size: var(--step-small); }
.fine li { padding-block: 0.55rem; }
.fine li + li { border-top: 1px solid var(--hairline); }

.contact { background: var(--accent); color: var(--on-accent); padding-block: var(--section-gap); }
.contact .inner { max-width: var(--shell); margin-inline: auto; padding-inline: var(--gutter); }
.credo { font-size: var(--step-lede); line-height: 1.3; letter-spacing: -0.015em; max-width: var(--measure); }
.credo span { display: block; }
.credo span + span { color: var(--on-accent-muted); }
.contact h2 { color: var(--on-accent); margin-top: 2.5rem; }
.contact p { max-width: var(--measure); color: var(--on-accent-muted); margin-top: var(--stack); }
.btn-light {
  display: inline-flex; align-items: center; background: var(--on-accent); color: var(--accent);
  font-weight: 600; font-size: 1.05rem; line-height: 1; padding: 0.85rem 1.4rem;
  border-radius: var(--radius); margin-top: 1.5rem;
}
.btn-light:hover { background: #fff; }
.contact .fineprint { display: block; margin-top: 0.8rem; font-size: var(--step-small); color: var(--on-accent-muted); }

.footer { border-top: 1px solid var(--hairline); background: var(--surface-2); padding: clamp(2rem, 1.4rem + 1.8vw, 3rem) var(--gutter); }
.footer .inner { max-width: var(--shell); margin-inline: auto; display: flex; align-items: baseline; justify-content: space-between; flex-wrap: wrap; gap: 0.6rem 1.25rem; }
.footer .meta { display: inline-flex; flex-wrap: wrap; gap: 0.55rem; font-size: var(--step-small); color: var(--ink-muted); }
.footer .meta a:hover { color: var(--accent); }
`

// Виджет и стартовые вопросы бесполезны без JS, поэтому показываются только
// после того, как скрипт объявит себя. Без этого страница отдавала бы мёртвые
// кнопки; текст самой страницы читается в любом случае.
const WIDGET_CSS = `
.js-only { display: none; }
.js .js-only { display: revert; }
.js .starters { display: flex; }

#w {
  position: fixed; z-index: var(--z-widget); right: clamp(1rem, 2vw, 1.75rem); bottom: clamp(1rem, 2vw, 1.75rem);
  display: flex; flex-direction: column; align-items: flex-end; gap: 0.7rem;
  font-size: var(--step-small);
}
#panel {
  width: min(24rem, calc(100vw - 2rem)); height: min(32rem, calc(100vh - 7rem));
  display: none; flex-direction: column; overflow: hidden;
  background: var(--surface); border: 1px solid var(--hairline-strong);
  border-radius: 0.9rem; box-shadow: 0 10px 40px oklch(0.2 0 0 / 0.16);
}
#w.open #panel { display: flex; }
#phead { display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; padding: 0.85rem 1rem; border-bottom: 1px solid var(--hairline); }
#phead .who { font-weight: 600; color: var(--ink-strong); }
#phead .sub { display: block; font-weight: 400; font-size: var(--step-label); color: var(--ink-muted); }
#close { background: none; border: 0; cursor: pointer; color: var(--ink-muted); font-size: 1.35rem; line-height: 1; padding: 0.15rem 0.35rem; }
#close:hover { color: var(--ink-strong); }
#log { flex: 1; overflow-y: auto; padding: 1rem; display: flex; flex-direction: column; gap: 0.8rem; }
#pq { display: flex; flex-wrap: wrap; gap: 0.4rem; }
#pq:empty { display: none; }
#pq button {
  font: inherit; font-size: var(--step-label); text-align: left; color: var(--ink);
  background: var(--surface); border: 1px solid var(--hairline-strong);
  border-radius: 999px; padding: 0.35rem 0.7rem; cursor: pointer;
}
#pq button:hover { border-color: var(--accent); color: var(--accent); }
.msg { padding: 0.65rem 0.85rem; border-radius: 0.7rem; white-space: pre-wrap; overflow-wrap: anywhere; line-height: 1.5; }
.me { background: var(--accent); color: var(--on-accent); align-self: flex-end; max-width: 85%; }
.bot { background: var(--surface-2); border: 1px solid var(--hairline); align-self: flex-start; max-width: 95%; }
.bot a { color: var(--accent); text-decoration: underline; }
#f { display: flex; gap: 0.5rem; padding: 0.75rem; border-top: 1px solid var(--hairline); }
#i { flex: 1; min-width: 0; font: inherit; padding: 0.6rem 0.7rem; border: 1px solid var(--hairline-strong); border-radius: var(--radius); background: var(--surface); color: var(--ink); }
#i::placeholder { color: var(--ink-muted); }
#send { flex: none; font: inherit; font-weight: 600; padding: 0.6rem 0.85rem; border: 0; border-radius: var(--radius); background: var(--accent); color: var(--on-accent); cursor: pointer; }
#send:hover { background: var(--accent-hover); }
#bubble {
  display: inline-flex; align-items: center; gap: 0.5rem; font: inherit; font-weight: 600;
  padding: 0.75rem 1.1rem; border: 0; border-radius: 999px;
  background: var(--accent); color: var(--on-accent); cursor: pointer; box-shadow: var(--shadow-cta);
}
#bubble:hover { background: var(--accent-hover); }
#w.open #bubble { display: none; }
/* The panel floats over the page, so on wide screens the page steps aside for
   it instead of being covered. Below that width there is nothing to step aside
   into, so the panel stays closed until it is asked for. */
/* The offset goes on the centred inner wrappers, not on body: section borders,
   the nav hairline and the petrol close must keep their full bleed. */
@media (min-width: 64rem) {
  .nav-inner, .spine, .contact .inner, .footer .inner {
    transition: margin-right 0.32s cubic-bezier(0.22, 1, 0.36, 1);
  }
  .panel-open .nav-inner,
  .panel-open .spine,
  .panel-open .contact .inner,
  .panel-open .footer .inner { margin-right: 27rem; }
}
@media (prefers-reduced-motion: reduce) {
  .nav-inner, .spine, .contact .inner, .footer .inner { transition: none; }
}
@media (max-width: 30rem) {
  #w { right: 0; bottom: 0; left: 0; align-items: stretch; gap: 0; }
  #w.open { top: 0; }
  #panel { width: 100%; height: 100%; border: 0; border-radius: 0; }
  #bubble { margin: 0 1rem 1rem auto; }
}
`

function head(title: string): string {
  return `<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<meta name="color-scheme" content="light">
<meta name="theme-color" content="#1c3a40">
<title>${title}</title>
<link rel="icon" href="https://coadvise.co/favicon.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Hanken+Grotesk:wght@400;500;600;800&display=swap">
<style>${TOKENS}${PAGE_CSS}${WIDGET_CSS}</style>`
}

const NAV = `<header class="nav">
  <div class="nav-inner">
    <a class="wordmark" href="https://coadvise.co">coadvise<span class="dot">.</span></a>
    <a class="cta" href="${MAILTO}">Book a call</a>
  </div>
</header>`

const FOOTER = `<footer class="footer">
  <div class="inner">
    <span class="wordmark">coadvise<span class="dot">.</span></span>
    <span class="meta">
      <a class="link" href="https://coadvise.co">coadvise.co</a>
      <span>&middot;</span>
      <a class="link" href="mailto:${EMAIL}">${EMAIL}</a>
    </span>
  </div>
</footer>`

/** Один шаблон на всех: под лида меняется только подстановка. */
export function renderPage(lead: Lead, accessKey: string): string {
  const name = escapeHtml(lead.name)
  const siteHost = escapeHtml(host(lead.site_url))
  const siteHref = escapeHtml(safeUrl(lead.site_url))
  const facts = asFacts(lead.proof_facts)
  const questions = asQuestions(lead.starter_questions)
  const pages = Number.isFinite(lead.pages_read) ? lead.pages_read : 0

  const proof = facts.length === 0 ? '' : `<section class="section" id="proof">
  <div class="spine">
    <div class="rail"><span class="label">What I read</span></div>
    <div class="body stack">
      <h2>${pages} public pages on ${siteHost}</h2>
      <p>Read straight from your site, nothing typed in by hand. A few of the things they say:</p>
      <ul class="facts">
${facts
  .map(
    (f) => `        <li>${escapeHtml(f.text)}
          <a class="src" href="${escapeHtml(safeUrl(f.url))}" target="_blank" rel="noopener noreferrer">${escapeHtml(host(f.url))}${escapeHtml(new URL(safeUrl(f.url), 'https://x.invalid').pathname)}</a>
        </li>`,
  )
  .join('\n')}
      </ul>
    </div>
  </div>
</section>`

  const starters = questions.length === 0 ? '' : `<div class="starters js-only">
${questions.map((q) => `        <button class="q" type="button">${escapeHtml(q)}</button>`).join('\n')}
      </div>`

  return `<!doctype html>
<html lang="en">
<head>
${head(`Assistant for ${name} &middot; coadvise`)}
</head>
<body>
${NAV}

<section class="section">
  <div class="spine">
    <div class="rail"><span class="label rise">Built for ${name}</span></div>
    <div class="body stack">
      <h1 class="rise" style="--d: 60ms">I read ${name}&rsquo;s website. Now you can ask it questions.</h1>
      <p class="lead rise" style="--d: 130ms">Before writing to you I pointed my pipeline at ${siteHost}, read every public page, and put an assistant on top of what it found. Ask it something only your own website would know.</p>
      <p class="muted rise" style="--d: 190ms">It answers from your public pages and nothing else, links every answer back to the page it came from, and tells you plainly when the answer isn&rsquo;t there. Ask in any language.</p>
    </div>
  </div>
</section>

${proof}

<section class="section" id="try">
  <div class="spine">
    <div class="rail"><span class="label">Try it</span></div>
    <div class="body stack">
      <h2>Ask it something</h2>
      <p>The assistant sits in the corner of this page. If you would rather start from a question I pulled out of your own pages:</p>
      ${starters}
      <p class="muted">Answers come with links, so every claim is one click from the page it came from. Twenty questions per visit, which is plenty to see whether it works.</p>
    </div>
  </div>
</section>

<section class="section">
  <div class="spine">
    <div class="rail"><span class="label">What else this does</span></div>
    <div class="body stack">
      <h2>A website is the easy version</h2>
      <p class="lead">Public pages are the simplest thing this pipeline can read. They are already written, already public, already meant for people. The harder material is the part nobody else can reach: the quoting spreadsheet, the shared inbox, the PDFs suppliers keep sending, the tickets somebody retypes into a second system every morning.</p>
      <p>The answer does not have to go to a visitor, either. More often it is worth pointing inward, at the person about to answer the same question for the fourth time this week, inside Slack or the tool they already have open.</p>
      <p>That work is what I actually do. This page is the twenty-minute version of it, and it built itself from one command pointed at your domain.</p>
    </div>
  </div>
</section>

<section class="section">
  <div class="spine">
    <div class="rail"><span class="label">The fine print</span></div>
    <div class="body">
      <ul class="fine">
        <li>Public pages only. Your <code>robots.txt</code> was fetched first and respected.</li>
        <li>Nothing about you is stored. Questions typed here are kept as plain text so I can tell whether the assistant is useful &mdash; no name, no email, no tracking.</li>
        <li>This page wears my styling, not yours. On a real build it matches your brand instead.</li>
        <li>The assistant only knows what was on ${siteHost} the day I read it. It will not know about anything published since.</li>
      </ul>
    </div>
  </div>
</section>

<section class="contact">
  <div class="inner">
    <p class="credo">
      <span>Find the work nobody measures.</span>
      <span>Automate the part that costs the most.</span>
      <span>Leave everything else alone.</span>
    </p>
    <h2>Let&rsquo;s talk</h2>
    <p>If the assistant found something useful &mdash; or something wrong &mdash; that is worth twenty minutes either way. No slides, no deck, just a look at where the repetitive work actually sits in your operation.</p>
    <a class="btn-light" href="${MAILTO}">Book a 20-minute call</a>
    <span class="fineprint">Twenty minutes is usually enough to see whether there&rsquo;s anything worth automating.</span>
  </div>
</section>

${FOOTER}

<div id="w" class="js-only" aria-live="polite">
  <div id="panel" role="dialog" aria-label="Assistant for ${name}">
    <div id="phead">
      <span class="who">${name}<span class="sub">answers from your site only</span></span>
      <button id="close" type="button" aria-label="Close the assistant">&times;</button>
    </div>
    <div id="log"><div id="pq"></div></div>
    <form id="f">
      <input id="i" placeholder="Ask about the site" autocomplete="off" maxlength="${MAX_QUESTION}" aria-label="Your question">
      <button id="send" type="submit">Ask</button>
    </form>
  </div>
  <button id="bubble" type="button">Ask the assistant</button>
</div>

<script>
document.documentElement.className += ' js';
const KEY = ${JSON.stringify(accessKey)};
const w = document.getElementById('w');
const log = document.getElementById('log');
const input = document.getElementById('i');
let session = null;
try { session = localStorage.getItem('sid'); } catch (e) {}
if (!session) {
  session = crypto.randomUUID();
  try { localStorage.setItem('sid', session); } catch (e) {}
}

function add(text, who) {
  const d = document.createElement('div');
  d.className = 'msg ' + who;
  d.textContent = text;
  log.appendChild(d);
  log.scrollTop = log.scrollHeight;
  return d;
}

const pq = document.getElementById('pq');
for (const b of document.querySelectorAll('.starters .q')) {
  const c = document.createElement('button');
  c.type = 'button';
  c.textContent = b.textContent;
  c.addEventListener('click', () => ask(c.textContent));
  pq.appendChild(c);
}

let greeted = false;
function open_(focus) {
  w.classList.add('open');
  document.documentElement.classList.add('panel-open');
  if (!greeted) {
    greeted = true;
    log.insertBefore(add(${JSON.stringify(
    'Ask me anything about your website. I answer only from the pages I read there, and I will say so when the answer is not in them.',
    )}, 'bot'), pq);
  }
  if (focus) input.focus();
}

function close_() {
  w.classList.remove('open');
  document.documentElement.classList.remove('panel-open');
}

document.getElementById('bubble').addEventListener('click', () => open_(true));
document.getElementById('close').addEventListener('click', close_);
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close_(); });

let busy = false;
async function ask(q) {
  if (busy) return;
  busy = true;
  open_(false);
  pq.replaceChildren();
  add(q, 'me');
  const pending = add('\\u2026', 'bot');
  try {
    const res = await fetch('/d/' + KEY + '/ask', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ question: q, session: session }),
    });
    const data = await res.json();
    pending.textContent = data.answer || 'I could not answer that one. Try again in a moment.';
  } catch (e) {
    pending.textContent = 'I could not reach the server. Try again in a moment.';
  }
  busy = false;
  log.scrollTop = log.scrollHeight;
}

document.getElementById('f').addEventListener('submit', (e) => {
  e.preventDefault();
  const q = input.value.trim();
  if (!q) return;
  input.value = '';
  ask(q);
});
document.querySelectorAll('.q').forEach((b) => b.addEventListener('click', () => ask(b.textContent)));

// The panel is the point of the page, so it opens itself where the page has
// room to step aside for it. On anything narrower it would cover the very
// content that makes people want to use it, so there it waits to be asked.
if (window.matchMedia('(min-width: 64rem)').matches) open_(false);
</script>
</body>
</html>`
}

/**
 * Ссылка протухла или в адресе опечатка. Человек попал сюда не случайно —
 * значит это не ошибка, а последний шанс, и страница зовёт написать.
 */
export function renderNotFound(): string {
  return `<!doctype html>
<html lang="en">
<head>
${head('This link isn&rsquo;t live &middot; coadvise')}
</head>
<body>
${NAV}

<section class="section">
  <div class="spine">
    <div class="rail"><span class="label">Expired link</span></div>
    <div class="body stack">
      <h1>This demo isn&rsquo;t live any more.</h1>
      <p class="lead">These pages get built one company at a time and they don&rsquo;t stay up for long. If you came here from an email of mine, replying to it is the fastest way to get another look &mdash; or write to me directly and I will rebuild it.</p>
      <a class="btn-accent" href="${MAILTO}">Email me</a>
      <p class="muted">You can also start from <a class="link" href="https://coadvise.co">coadvise.co</a>, which explains what these are for.</p>
    </div>
  </div>
</section>

${FOOTER}
</body>
</html>`
}
