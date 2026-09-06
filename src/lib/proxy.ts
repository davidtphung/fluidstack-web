/** Direct browser fetches to GIS hosts (CORS ACAO * or Origin reflect). No /api/proxy. */

export async function proxyGet(url: string): Promise<Response> {
  return fetch(url, {
    method: "GET",
    headers: { Accept: "application/json,*/*" },
  })
}

export async function proxyPostForm(
  url: string,
  form: Record<string, string>,
): Promise<Response> {
  const body = new URLSearchParams(form).toString()
  return fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json,*/*",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body,
  })
}

export async function proxyJson<T>(url: string): Promise<T> {
  const res = await proxyGet(url)
  if (!res.ok) throw new Error(`GET ${res.status}`)
  return res.json() as Promise<T>
}

export async function proxyPostJson<T>(
  url: string,
  form: Record<string, string>,
): Promise<T> {
  const res = await proxyPostForm(url, form)
  if (!res.ok) throw new Error(`POST ${res.status}`)
  return res.json() as Promise<T>
}
