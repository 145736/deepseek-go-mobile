// Streamable HTTP client for the configured service. No local subprocesses or proxy.
type Dict = Record<string, unknown>
type Rpc = { id?: number; result?: Dict; error?: { code: number; message: string } }
export type Tool = { name: string; inputSchema?: Dict }

async function responseMessage(response: Response, id: number): Promise<Dict> {
  let message: Rpc | undefined
  if (response.headers.get('content-type')?.includes('text/event-stream') && response.body) {
    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let buffer = ''
    try {
      while (!message) {
        const chunk = await reader.read()
        buffer += decoder.decode(chunk.value, { stream: !chunk.done })
        const frames = buffer.split(/\r?\n\r?\n/u)
        buffer = frames.pop() ?? ''
        if (chunk.done && buffer.trim()) {
          frames.push(buffer)
        }
        for (const frame of frames) {
          const data = frame
            .split(/\r?\n/u)
            .filter((l) => l.startsWith('data:'))
            .map((l) => l.slice(5).trimStart())
            .join('\n')
          if (!data) {
            continue
          }
          const candidate: Rpc = JSON.parse(data)
          if (candidate.id === id) {
            message = candidate
            break
          }
        }
        if (chunk.done) {
          break
        }
      }
    } finally {
      await reader.cancel().catch(() => {})
    }
  } else {
    message = await response.json()
  }
  if (message?.id !== id || !message.result || message.error) {
    throw Error('服务未完成请求' + (message?.error ? '（' + message.error.code + '）' : ''))
  }
  return message.result
}

export function mcpClient(endpoint: string, token: string, signal?: AbortSignal) {
  let session = ''
  let version = '2025-03-26'
  let sequence = 0
  async function post(method: string, params?: Dict, notification = false): Promise<Dict> {
    const id = ++sequence
    const headers = new Headers({
      'Content-Type': 'application/json',
      Accept: 'application/json, text/event-stream',
    })
    if (session) {
      headers.set('Mcp-Session-Id', session)
    }
    if (method !== 'initialize') {
      headers.set('MCP-Protocol-Version', version)
    }
    if (token) {
      headers.set('Authorization', 'Bearer ' + token)
    }
    const timeout = new AbortController()
    const abort = () => timeout.abort()
    signal?.throwIfAborted()
    signal?.addEventListener('abort', abort, { once: true })
    const timer = setTimeout(abort, 45000)
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        headers,
        credentials: 'omit',
        redirect: 'error',
        signal: timeout.signal,
        body: JSON.stringify({ jsonrpc: '2.0', ...(notification ? {} : { id }), method, params }),
      })
      if (!res.ok) {
        throw Error('服务返回 HTTP ' + res.status)
      }
      if (method === 'initialize') {
        session = res.headers.get('mcp-session-id') ?? ''
      }
      return notification ? {} : await responseMessage(res, id)
    } finally {
      clearTimeout(timer)
      signal?.removeEventListener('abort', abort)
    }
  }
  return {
    async open() {
      const hello = await post('initialize', {
        protocolVersion: version,
        capabilities: {},
        clientInfo: { name: 'deepseek-suixing', version: '1.0' },
      })
      if (typeof hello.protocolVersion !== 'string') {
        throw Error('MCP 握手失败')
      }
      version = hello.protocolVersion
      await post('notifications/initialized', undefined, true)
    },
    async tools(): Promise<Tool[]> {
      const all: Tool[] = []
      let cursor: string | undefined
      const seen = new Set<string>()
      do {
        const page = await post('tools/list', cursor ? { cursor } : {})
        if (!Array.isArray(page.tools)) {
          throw Error('服务未返回工具清单')
        }
        all.push(...page.tools)
        cursor = typeof page.nextCursor === 'string' ? page.nextCursor : undefined
        if (cursor && seen.has(cursor)) {
          throw Error('工具目录重复返回同一页')
        }
        if (cursor) {
          seen.add(cursor)
        }
      } while (cursor && all.length < 500)
      return all
    },
    async call(name: string, args: Dict): Promise<string> {
      const result = await post('tools/call', { name, arguments: args })
      if (result.isError) {
        throw Error(name + ' 未成功，请检查目标、服务权限及输入。')
      }
      const content = Array.isArray(result.content) ? result.content : []
      const parts = content.flatMap((v: Dict) => {
        if (v.type === 'text') {
          return [String(v.text)]
        }
        if (v.type === 'resource' && v.resource && typeof v.resource === 'object') {
          const resource = v.resource as Dict
          if (typeof resource.text === 'string') {
            return [resource.text]
          }
          if (typeof resource.blob === 'string' && resource.blob.length <= 500_000) {
            return [
              new TextDecoder().decode(
                Uint8Array.from(atob(resource.blob), (c) => c.charCodeAt(0))
              ),
            ]
          }
        }
        return []
      })
      return parts.join('\n') || JSON.stringify(result.structuredContent ?? {})
    },
    async close() {
      if (!session) {
        return
      }
      const headers = new Headers({ 'Mcp-Session-Id': session, 'MCP-Protocol-Version': version })
      if (token) {
        headers.set('Authorization', 'Bearer ' + token)
      }
      await fetch(endpoint, {
        method: 'DELETE',
        headers,
        credentials: 'omit',
        redirect: 'error',
        signal: AbortSignal.timeout(3500),
      }).catch(() => {})
    },
  }
}
