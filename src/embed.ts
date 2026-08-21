export const DIMENSIONS = 768
const MODEL = 'gemini-embedding-001'
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:batchEmbedContents`

/**
 * Gemini не нормализует выходы, отличные от 3072 измерений, а косинусный поиск
 * pgvector на ненормализованных векторах даёт мусор. Вызывается на обоих концах:
 * при индексации и при запросе.
 */
export function normalize(v: number[]): number[] {
  const norm = Math.hypot(...v)
  if (norm === 0) return v.slice()
  return v.map((x) => x / norm)
}

export type TaskType = 'RETRIEVAL_DOCUMENT' | 'RETRIEVAL_QUERY'

/** Эмбеддит пачку текстов. Батч не больше 100 — ограничение API. */
export async function embed(
  texts: string[],
  taskType: TaskType,
  apiKey = process.env.GEMINI_API_KEY,
): Promise<number[][]> {
  if (!apiKey) throw new Error('нет GEMINI_API_KEY')
  if (texts.length === 0) return []
  if (texts.length > 100) throw new Error(`батч ${texts.length} > 100, режь мельче`)

  const res = await fetch(`${ENDPOINT}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      requests: texts.map((text) => ({
        model: `models/${MODEL}`,
        content: { parts: [{ text }] },
        taskType,
        outputDimensionality: DIMENSIONS,
      })),
    }),
  })
  if (!res.ok) throw new Error(`Gemini embed: ${res.status} ${await res.text()}`)

  const json = (await res.json()) as { embeddings: { values: number[] }[] }
  return json.embeddings.map((e) => normalize(e.values))
}
