export type FetchIssue = {
  kind: "blocked" | "http" | "parse" | "other"
  message: string
}

export class CorsFetchError extends Error {
  issue: FetchIssue
  constructor(issue: FetchIssue) {
    super(issue.message)
    this.name = "CorsFetchError"
    this.issue = issue
  }
}

function classify(err: unknown, host: string): FetchIssue {
  if (err instanceof CorsFetchError) return err.issue
  if (err instanceof TypeError) {
    return {
      kind: "blocked",
      message: `${host}: CORS blocked or network failed. Layer marked UNKNOWN.`,
    }
  }
  const msg = err instanceof Error ? err.message : "request failed"
  return { kind: "other", message: `${host}: ${msg}` }
}

export function describeIssue(err: unknown, host: string): FetchIssue {
  return classify(err, host)
}

export async function corsGet(url: string): Promise<Response> {
  const host = (() => {
    try { return new URL(url).hostname } catch { return "source" }
  })()
  try {
    const res = await fetch(url, {
      method: "GET",
      credentials: "omit",
      mode: "cors",
    })
    return res
  } catch (err) {
    throw new CorsFetchError(classify(err, host))
  }
}

export async function corsGetJson<T>(url: string): Promise<T> {
  const host = (() => {
    try { return new URL(url).hostname } catch { return "source" }
  })()
  const res = await corsGet(url)
  if (!res.ok) {
    throw new CorsFetchError({
      kind: "http",
      message: `${host}: HTTP ${res.status}`,
    })
  }
  try {
    return (await res.json()) as T
  } catch {
    throw new CorsFetchError({
      kind: "parse",
      message: `${host}: response was not JSON`,
    })
  }
}

export function withQuery(url: string, params: Record<string, string>): string {
  const u = new URL(url)
  for (const [k, v] of Object.entries(params)) u.searchParams.set(k, v)
  return u.toString()
}
