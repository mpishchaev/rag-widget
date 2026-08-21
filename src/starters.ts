/** Достаёт вопросы из свободного ответа модели. Модель нередко добавляет преамбулу. */
export function parseStarters(raw: string): string[] {
  return raw
    .split('\n')
    .map((l) => l.replace(/^\s*(?:\d+[.)]|[-*•])\s*/, '').trim())
    .filter((l) => l.endsWith('?') && l.length > 5)
    .slice(0, 4)
}

const PROMPT = [
  'Ниже — фрагменты публичного сайта компании.',
  'Придумай 3-4 коротких вопроса, которые задал бы её потенциальный клиент.',
  'Вопросы должны опираться на приведённый текст и звучать естественно.',
  'Выведи только список вопросов, по одному в строке, без пояснений.',
].join(' ')

export async function suggestStarters(text: string, apiKey = process.env.GEMINI_API_KEY): Promise<string[]> {
  const res = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',
    {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-goog-api-key': apiKey ?? '' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${PROMPT}\n\n---\n${text.slice(0, 12000)}` }] }],
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
