import { create } from 'zustand'

export const providers = ['Notion', 'GitHub', 'regs'] as const
export type Provider = (typeof providers)[number]
export type Connection = {
  target: string
  token: string
  enabled: boolean
  checked: number
  refresh?: string
  expires?: number
  client?: string
}
const key = (p: Provider) => 'suixing:connection:' + p
const empty = (): Connection => ({ target: '', token: '', enabled: false, checked: 0 })
function load(p: Provider): Connection {
  try {
    return { ...empty(), ...JSON.parse(localStorage.getItem(key(p)) || '{}') }
  } catch {
    return empty()
  }
}
export const useConnections = create<Record<Provider, Connection>>(() => ({
  Notion: load('Notion'),
  GitHub: load('GitHub'),
  regs: load('regs'),
}))
export function saveConnection(p: Provider, c: Connection) {
  localStorage.setItem(key(p), JSON.stringify(c))
  useConnections.setState({ [p]: c })
}
export function forgetConnection(p: Provider) {
  localStorage.removeItem(key(p))
  useConnections.setState({ [p]: empty() })
}
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    for (const provider of providers) {
      if (event.key === null || event.key === key(provider)) {
        useConnections.setState({ [provider]: load(provider) })
      }
    }
  })
}
export function repoPath(value: string) {
  const repo = value
    .trim()
    .replace(/^https:\/\/github\.com\//i, '')
    .replace(/\/$/, '')
  if (!/^[\w-]+\/[\w.-]+$/.test(repo) || /\/(\.|\.\.)$/.test(repo)) {
    throw Error('请填写仓库，例如 145736/deepseek-go-mobile')
  }
  return repo
}
export function regsEndpoint(value: string) {
  let url: URL
  try {
    url = new URL(value.trim())
  } catch {
    throw Error('请填写 regs 的完整 HTTPS MCP 地址')
  }
  if (url.protocol !== 'https:' || url.username || url.password || url.hash || url.search) {
    throw Error('请使用 HTTPS 地址，并将令牌填在独立字段')
  }
  return url.href
}
export const notionEndpoint = 'https://mcp.notion.com/mcp'
