import { mcpClient } from './mcp.js'
import {
  notionEndpoint,
  regsEndpoint,
  repoPath,
  useConnections,
  type Connection,
  type Provider,
} from './config.js'
import { notionSession } from './notionAuth.js'

export type Activity = { provider: Provider; label: string; url?: string }
export type ReadResult = { data: string; activities: Activity[] }
export type WriteDraft = {
  provider: 'GitHub' | 'Notion'
  target: string
  title: string
  body: string
}
function safeLink(value: unknown) {
  if (typeof value !== 'string') {
    return undefined
  }
  try {
    const url = new URL(value)
    return url.protocol === 'https:' ? url.href : undefined
  } catch {
    return undefined
  }
}
function parsed(text: string) {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}
export function pageId(value: string) {
  const raw = value.trim()
  const path = raw.startsWith('https://') ? new URL(raw).pathname : raw
  const id = path.match(
    /(?:^|[-/])([a-f0-9]{32}|[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12})\/?$/i
  )?.[1]
  if (!id) {
    throw Error('请填写 Notion 父页面链接或页面 ID')
  }
  return id.replaceAll('-', '').replace(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/, '$1-$2-$3-$4-$5')
}
function repository(c: Connection) {
  const [owner, repo] = repoPath(c.target).split('/')
  return { owner, repo }
}
async function withMcp<T>(
  p: Provider,
  c: Connection,
  signal: AbortSignal | undefined,
  run: (client: ReturnType<typeof mcpClient>) => Promise<T>
) {
  const endpoint =
    p === 'regs'
      ? regsEndpoint(c.target)
      : p === 'Notion'
        ? notionEndpoint
        : 'https://api.githubcopilot.com/mcp/'
  const token = p === 'Notion' ? (await notionSession(c)).token : c.token
  if (p === 'Notion' && !token) {
    throw Error('请先在扩展库授权 Notion')
  }
  if (p === 'GitHub' && !token) {
    throw Error('请填写仅授权目标仓库的 GitHub 令牌')
  }
  const client = mcpClient(endpoint, token, signal)
  try {
    await client.open()
    return await run(client)
  } finally {
    await client.close()
  }
}
export async function verifyConnection(p: Provider, c: Connection) {
  await withMcp(p, c, undefined, async (client) => {
    const names = (await client.tools()).map((t) => t.name)
    const required =
      p === 'regs'
        ? ['search', 'fetch', 'list']
        : p === 'GitHub'
          ? ['list_commits']
          : ['notion-search', 'notion-fetch']
    if (!required.every((n) => names.includes(n))) {
      throw Error('服务缺少读取所需的工具')
    }
    if (p === 'regs') {
      await client.call('list', {})
    } else if (p === 'GitHub') {
      await client.call('list_commits', { ...repository(c), perPage: 1 })
    } else {
      await client.call('notion-search', { query: 'DeepSeek', query_type: 'internal' })
    }
  })
}
export function detectConnection(text: string) {
  const named = /(?:^|\s)[@＠](Notion|GitHub|regs)(?=$|[\s，,：:])/i.exec(text)
  const natural = /(?:Notion|GitHub|\bregs\b|法规库)/i.exec(text)
  if (
    !named &&
    (!natural ||
      !/查|读|找|获取|搜索|看看|列出|保存|写入|创建|新建|提交|整理|总结|最近|search|read|save|create/i.test(
        text
      ))
  ) {
    return
  }
  const name = (named?.[1] ?? natural?.[0])?.toLowerCase()
  const provider: Provider = name === 'notion' ? 'Notion' : name === 'github' ? 'GitHub' : 'regs'
  const task = text
    .replace(named?.[0] ?? natural?.[0] ?? '', ' ')
    .trim()
    .replace(/^[，,:：]\s*/, '')
  const write =
    provider === 'GitHub'
      ? /(?:创建|新建|提交|开(?:一[个条])?|create|open)\s*(?:一[个条份])?\s*(?:github\s*)?issue/i.test(
          text
        )
      : provider === 'Notion' && /保存|写入|新建|存到|存入|创建|save|create/i.test(text)
  return { provider, task, write, explicit: !!named }
}

export async function readConnection(
  p: Provider,
  c: Connection,
  task: string,
  signal: AbortSignal
): Promise<ReadResult> {
  const activities: Activity[] = []
  let data: string
  if (p === 'GitHub') {
    const repo = repoPath(c.target)
    const number = /(?:issue\s*#?\s*|#)(\d+)\b/i.exec(task)?.[1]
    const pr = /pull requests?|\bpr\b|合并请求/i.test(task)
    const readme = /readme|说明文档/i.test(task)
    const issues = /issues?|工单/i.test(task)
    const scope = repository(c)
    const tool = readme
      ? 'get_file_contents'
      : number
        ? pr
          ? 'pull_request_read'
          : 'issue_read'
        : pr
          ? 'list_pull_requests'
          : issues
            ? 'list_issues'
            : 'list_commits'
    const args = readme
      ? { path: 'README.md' }
      : number
        ? pr
          ? { pullNumber: Number(number), method: 'get' }
          : { issue_number: Number(number), method: 'get' }
        : { perPage: 8 }
    data = await withMcp(p, c, signal, (client) => client.call(tool, { ...scope, ...args }))
    const page = pr
      ? number
        ? '/pull/' + number
        : '/pulls'
      : issues || number
        ? number
          ? '/issues/' + number
          : '/issues'
        : readme
          ? '#readme'
          : '/commits'
    activities.push({
      provider: p,
      label:
        repo +
        ' · ' +
        (readme
          ? 'README'
          : number
            ? '#' + number
            : pr
              ? 'Pull Requests'
              : issues
                ? 'Issues'
                : '最近提交'),
      url: 'https://github.com/' + repo + page,
    })
    const result = parsed(data)
    const rows = Array.isArray(result)
      ? result
      : (result?.issues ?? result?.commits ?? result?.pull_requests ?? [])
    if (Array.isArray(rows)) {
      for (const row of rows.slice(0, 5)) {
        const title = row.title ?? row.commit?.message ?? row.message
        if (title) {
          activities.push({
            provider: p,
            label: String(title).split('\n')[0].slice(0, 140),
            url: safeLink(row.html_url),
          })
        }
      }
    }
  } else {
    data = await withMcp(p, c, signal, async (client) => {
      const quoted = /[「“"]([^」”"]+)[」”"]/.exec(task)?.[1]
      const url = task.match(/https:\/\/[^\s，。]+/)?.[0]
      if (p === 'Notion' && url) {
        const id = pageId(url)
        const result = await client.call('notion-fetch', { id })
        activities.push({
          provider: p,
          label: '读取页面 ' + id,
          url: 'https://www.notion.so/' + id.replaceAll('-', ''),
        })
        return result
      }
      const query = (
        quoted ?? task.replace(/^(?:请|帮我|从我的|查一下|搜索|查找|找到|查询|查|找|读)\s*/g, '')
      ).slice(0, 400)
      if (!query) {
        throw Error('请给出关键词或页面链接')
      }
      const result = await client.call(
        p === 'Notion' ? 'notion-search' : 'search',
        p === 'Notion' ? { query, query_type: 'internal' } : { query, limit: 4 }
      )
      activities.push({ provider: p, label: '搜索「' + query + '」' })
      const parsedResult = parsed(result)
      const first =
        p === 'regs'
          ? parsedResult?.hits?.[0]
          : parsedResult?.results?.find(
              (r: { type?: string; id?: string }) => r.id && (!r.type || r.type === 'page')
            )
      if (typeof first?.id !== 'string') {
        return result
      }
      const details = await client.call(p === 'Notion' ? 'notion-fetch' : 'fetch', { id: first.id })
      activities.push({
        provider: p,
        label: '读取 ' + String(first.title ?? first.source ?? first.id),
        url: safeLink(first.url),
      })
      return result.slice(0, 6500) + '\n' + details
    })
  }
  return { data: data.slice(0, 24000), activities }
}
export async function writeConnection(d: WriteDraft, c: Connection): Promise<Activity> {
  if (!d.title.trim() || !d.body.trim()) {
    throw Error('请填写标题和正文')
  }
  if (d.provider === 'GitHub') {
    if (repoPath(d.target) !== repoPath(c.target)) {
      throw Error('目标仓库已变更，请重新确认')
    }
    if (!c.token) {
      throw Error('创建 Issue 需要允许写入该仓库 Issues 的令牌')
    }
    const text = await withMcp('GitHub', c, undefined, (client) =>
      client.call('issue_write', {
        method: 'create',
        ...repository(c),
        title: d.title,
        body: d.body,
      })
    )
    const result = parsed(text)
    const url = safeLink(result?.html_url ?? result?.url)
    const number = result?.number ?? url?.match(/\/issues\/(\d+)\/?$/)?.[1]
    if (!number || !/^\d+$/.test(String(number))) {
      throw Error('未收到 Issue 编号')
    }
    return {
      provider: 'GitHub',
      label: '已创建 Issue #' + number,
      url: 'https://github.com/' + repoPath(c.target) + '/issues/' + number,
    }
  }
  const parent = pageId(d.target)
  return withMcp('Notion', c, undefined, async (client) => {
    const tools = await client.tools()
    if (!tools.some((t) => t.name === 'notion-create-pages')) {
      throw Error('当前授权无法创建 Notion 页面')
    }
    const text = await client.call('notion-create-pages', {
      parent: { page_id: parent },
      pages: [{ properties: { title: d.title }, content: d.body }],
    })
    const result = parsed(text)
    const page = result?.pages?.[0] ?? result
    let url = safeLink(page?.url)
    if (!url && page?.id) {
      url = 'https://www.notion.so/' + pageId(page.id).replaceAll('-', '')
    }
    if (!url) {
      throw Error('未收到创建页面的回执')
    }
    return { provider: 'Notion', label: '已创建页面 · ' + d.title, url }
  })
}
export function requireConnection(p: Provider) {
  const c = useConnections.getState()[p]
  if (!c.enabled || !c.checked) {
    throw Error('请先在「设置 → 扩展库 → MCP」连接并启用 ' + p)
  }
  return c
}
