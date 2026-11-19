import { saveConnection, useConnections, type Connection } from './config.js'

const origin = 'https://mcp.notion.com'
const pendingKey = 'suixing:notion:authorization'
const clientKey = 'suixing:notion:public-client:'
const callback = () => location.origin + location.pathname + '?notion_callback=1'
const b64 = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
const random = () => b64(crypto.getRandomValues(new Uint8Array(32)))
async function authorizePost(path: string, body: BodyInit, type: string) {
  const res = await fetch(origin + path, {
    method: 'POST',
    headers: { 'Content-Type': type, Accept: 'application/json' },
    body,
    credentials: 'omit',
    redirect: 'error',
    signal: AbortSignal.timeout(25000),
  })
  if (!res.ok) {
    throw Error('Notion 授权失败（HTTP ' + res.status + '），请重新连接。')
  }
  return res.json()
}
export async function startNotionAuth() {
  const redirect = callback()
  // Public OAuth identifier registered for the deployed callback. PKCE binds each login to its initiating browser.
  let client =
    redirect === 'https://145736.github.io/deepseek-go-mobile/?notion_callback=1'
      ? 'hSrTMtQyx4SDZcde'
      : localStorage.getItem(clientKey + redirect)
  if (!client) {
    const registration = await authorizePost(
      '/register',
      JSON.stringify({
        client_name: 'DeepSeek 随行',
        redirect_uris: [redirect],
        token_endpoint_auth_method: 'none',
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
      }),
      'application/json'
    )
    if (typeof registration.client_id !== 'string') {
      throw Error('Notion 没有返回客户端编号')
    }
    client = registration.client_id as string
    localStorage.setItem(clientKey + redirect, client)
  }
  const verifier = random(),
    state = random()
  const challenge = b64(
    new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier)))
  )
  sessionStorage.setItem(
    pendingKey,
    JSON.stringify({ state, verifier, client, redirect, created: Date.now() })
  )
  const query = new URLSearchParams({
    response_type: 'code',
    client_id: client,
    redirect_uri: redirect,
    state,
    code_challenge: challenge,
    code_challenge_method: 'S256',
    resource: origin + '/mcp',
  })
  location.assign(origin + '/authorize?' + query.toString())
}
async function exchange(params: Record<string, string>, prior: Connection): Promise<Connection> {
  const data = await authorizePost(
    '/token',
    new URLSearchParams({ ...params, resource: origin + '/mcp' }),
    'application/x-www-form-urlencoded'
  )
  if (typeof data.access_token !== 'string' || !data.access_token) {
    throw Error('Notion 没有返回访问令牌')
  }
  return {
    ...prior,
    client: params.client_id,
    token: data.access_token,
    refresh: data.refresh_token ?? prior.refresh,
    expires: data.expires_in ? Date.now() + Number(data.expires_in) * 1000 : undefined,
  }
}
export async function finishNotionAuth() {
  const url = new URL(location.href)
  if (!url.searchParams.has('notion_callback')) {
    return false
  }
  const pending = JSON.parse(sessionStorage.getItem(pendingKey) || 'null')
  sessionStorage.removeItem(pendingKey)
  history.replaceState(null, '', location.pathname)
  if (
    !pending ||
    url.searchParams.get('state') !== pending.state ||
    Date.now() - pending.created > 15 * 60_000
  ) {
    throw Error('授权窗口已过期，请在本浏览器内重新连接 Notion。')
  }
  const code = url.searchParams.get('code')
  if (!code) {
    throw Error('Notion 授权已取消')
  }
  const c = await exchange(
    {
      grant_type: 'authorization_code',
      client_id: pending.client,
      redirect_uri: pending.redirect,
      code_verifier: pending.verifier,
      code,
    },
    { target: '', token: '', enabled: false, checked: 0 }
  )
  saveConnection('Notion', c)
  return true
}
let renewing: Promise<Connection> | undefined
export async function notionSession(c: Connection): Promise<Connection> {
  if (!c.expires || Date.now() + 60_000 < c.expires) {
    return c
  }
  if (!c.client || !c.refresh) {
    throw Error('Notion 授权已过期，请重新连接')
  }
  renewing ??= exchange(
    { grant_type: 'refresh_token', client_id: c.client, refresh_token: c.refresh },
    c
  )
    .then((next) => {
      const current = useConnections.getState().Notion
      if (current.token !== c.token) {
        throw Error('连接已变更')
      }
      const merged = {
        ...next,
        enabled: current.enabled,
        target: current.target,
        checked: current.checked,
      }
      saveConnection('Notion', merged)
      return merged
    })
    .finally(() => {
      renewing = undefined
    })
  return renewing
}
