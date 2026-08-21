export type DbEnv = { url: string; key: string }

export function restUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, '')}/rest/v1/${path}`
}

function envFromProcess(): DbEnv {
  const url = process.env.SUPABASE_URL
  const key = process.env.SUPABASE_SECRET_KEY
  if (!url || !key) throw new Error('нет SUPABASE_URL или SUPABASE_SECRET_KEY (см. .dev.vars)')
  return { url, key }
}

/** Вызов RPC PostgREST. В Worker'е env передаётся явно, в CLI берётся из process.env. */
export async function rpc<T>(
  name: string,
  params: Record<string, unknown>,
  env?: DbEnv,
): Promise<T> {
  const { url, key } = env ?? envFromProcess()
  const res = await fetch(restUrl(url, `rpc/${name}`), {
    method: 'POST',
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify(params),
  })
  if (!res.ok) throw new Error(`RPC ${name}: ${res.status} ${await res.text()}`)
  // Функции, возвращающие void (log_question), дают 204 с пустым телом —
  // res.json() на нём кидает SyntaxError уже после успешной вставки.
  if (res.status === 204) return null as T
  const body = await res.text()
  return (body ? JSON.parse(body) : null) as T
}

/** Прямая запись в таблицу. Доступна только секретному ключу — RLS не пускает publishable. */
export async function insert(table: string, rows: unknown[], env?: DbEnv): Promise<void> {
  if (rows.length === 0) return
  const { url, key } = env ?? envFromProcess()
  const res = await fetch(restUrl(url, table), {
    method: 'POST',
    headers: {
      apikey: key,
      authorization: `Bearer ${key}`,
      'content-type': 'application/json',
      prefer: 'return=minimal',
    },
    body: JSON.stringify(rows),
  })
  if (!res.ok) throw new Error(`insert ${table}: ${res.status} ${await res.text()}`)
}
