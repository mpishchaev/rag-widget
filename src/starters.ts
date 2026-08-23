import { escapeSource } from './prompt.ts'

export const MAX_STARTER = 200

/** Достаёт вопросы из свободного ответа модели. Модель нередко добавляет преамбулу. */
export function parseStarters(raw: string): string[] {
  return raw
    .split('\n')
    .map((l) => l.replace(/^\s*(?:\d+[.)]|[-*•])\s*/, '').trim())
    // Длина ограничена с обеих сторон: абзац-простыня, случайно кончающийся на
    // «?», не должен стать карточкой во всю страницу.
    .filter((l) => l.endsWith('?') && l.length > 5 && l.length <= MAX_STARTER)
    .slice(0, 4)
}

const MAX_SAMPLE = 12000

const PROMPT = [
  'Below are excerpts from a company public website.',
  'Write 3-4 short questions a prospective customer of that company would ask.',
  'The questions must be grounded in the text above and sound natural.',
  // Вопросы читает адресат письма на своём же сайте: язык вопросов обязан
  // совпадать с языком его контента, а не с языком этой инструкции.
  'Write them in the same language as the website text.',
  'Output only the list of questions, one per line, with no explanations.',
].join(' ')

/**
 * Текст с сайта лида — недоверенный ввод: он попадает к модели только через тот
 * же слой экранирования, что и ответы посетителю (см. buildPrompt в prompt.ts).
 * Инструкция стоит до и после данных — так её труднее перехватить из середины.
 */
export function buildStartersPrompt(text: string): string {
  return [
    PROMPT,
    '',
    '<source>',
    escapeSource(text.slice(0, MAX_SAMPLE)),
    '</source>',
    '',
    PROMPT,
  ].join('\n')
}

export async function suggestStarters(text: string, apiKey = process.env.GEMINI_API_KEY): Promise<string[]> {
  const res = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey ?? '' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: buildStartersPrompt(text) }] }],
        // Измерено живым вызовом: с thinking включённым 284 из 300 токенов бюджета
        // уходят в thoughtsTokenCount, ответ обрывается на MAX_TOKENS. Извлечение
        // вопросов из текста не требует рассуждений — отключаем thinking целиком.
        generationConfig: { temperature: 0.4, maxOutputTokens: 300, thinkingConfig: { thinkingBudget: 0 } },
      }),
    },
  )
  // Пустой список неотличим от «модель ничего путного не написала» — печатаем
  // статус, чтобы не путать сбой API (авторизация/квота/rate limit) с этим случаем.
  if (!res.ok) {
    console.error(`suggestStarters: Gemini ответил ${res.status}`)
    return []
  }
  const data = (await res.json()) as { candidates?: { content: { parts: { text: string }[] } }[] }
  return parseStarters(data.candidates?.[0]?.content?.parts?.[0]?.text ?? '')
}
