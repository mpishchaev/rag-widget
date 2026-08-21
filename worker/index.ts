import { rpc } from '../src/db.ts'
import { embed } from '../src/embed.ts'
import {
  buildPrompt, hasAnswer, truncateQuestion, NO_ANSWER, MAX_SESSION,
  type Source,
} from '../src/prompt.ts'
import { renderPage, type Lead } from './page.ts'

type Env = {
  SUPABASE_URL: string
  SUPABASE_PUBLISHABLE_KEY: string
  GEMINI_API_KEY: string
}

const GEN_MODEL = 'gemini-2.5-flash'

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}

async function generate(prompt: string, apiKey: string): Promise<string> {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEN_MODEL}:generateContent`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 800 },
      }),
    },
  )
  if (!res.ok) throw new Error(`Gemini generate: ${res.status}`)
  const data = (await res.json()) as { candidates?: { content: { parts: { text: string }[] } }[] }
  return data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ?? NO_ANSWER
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)
    const match = url.pathname.match(/^\/d\/([A-Za-z0-9]{16,128})(\/ask)?$/)
    if (!match) return new Response('Not found', { status: 404 })

    const accessKey = match[1]
    const db = { url: env.SUPABASE_URL, key: env.SUPABASE_PUBLISHABLE_KEY }

    // Страница
    if (!match[2]) {
      const rows = await rpc<Lead[]>('get_lead_page', { p_access_key: accessKey }, db)
      if (rows.length === 0) return new Response('Not found', { status: 404 })
      return new Response(renderPage(rows[0], accessKey), {
        headers: { 'content-type': 'text/html; charset=utf-8', 'x-robots-tag': 'noindex' },
      })
    }

    // Вопрос
    if (request.method !== 'POST') return new Response('Method not allowed', { status: 405 })

    const body = (await request.json().catch(() => ({}))) as { question?: string; session?: string }
    const question = truncateQuestion((body.question ?? '').trim())
    const session = (body.session ?? '').slice(0, 64)
    if (!question || !session) return json({ answer: 'Пустой вопрос.' })

    const used = await rpc<number>('session_count', { p_access_key: accessKey, p_session: session }, db)
    if (used >= MAX_SESSION) {
      return json({ answer: `Достигнут потолок в ${MAX_SESSION} вопросов. Напишите команде напрямую.` })
    }

    const [vector] = await embed([question], 'RETRIEVAL_QUERY', env.GEMINI_API_KEY)
    const sources = await rpc<Source[]>(
      'match_chunks',
      { p_access_key: accessKey, p_embedding: JSON.stringify(vector), p_k: 6 },
      db,
    )

    // Отсечка до модели: нет близких чанков — нет и генерации.
    if (!hasAnswer(sources)) {
      await rpc('log_question', { p_access_key: accessKey, p_session: session, p_q: question, p_had_answer: false }, db)
      return json({ answer: NO_ANSWER })
    }

    let answer: string
    try {
      answer = await generate(buildPrompt(question, sources), env.GEMINI_API_KEY)
    } catch {
      answer = 'Модель не ответила. Попробуйте ещё раз через минуту.'
    }
    await rpc('log_question', { p_access_key: accessKey, p_session: session, p_q: question, p_had_answer: true }, db)
    return json({ answer })
  },

  /** Пинг раз в сутки: Supabase усыпляет проект после 7 дней низкой активности. */
  async scheduled(_event: unknown, env: Env): Promise<void> {
    const db = { url: env.SUPABASE_URL, key: env.SUPABASE_PUBLISHABLE_KEY }
    await rpc('get_lead_page', { p_access_key: 'keepalive' }, db).catch(() => {})
  },
}
