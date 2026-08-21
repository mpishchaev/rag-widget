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
        generationConfig: { temperature: 0.4, maxOutputTokens: 300 },
      }),
    },
  )
  if (!res.ok) return []
  const data = (await res.json()) as { candidates?: { content: { parts: { text: string }[] } }[] }
  return parseStarters(data.candidates?.[0]?.content?.parts?.[0]?.text ?? '')
}
