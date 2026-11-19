import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  detectConnection,
  pageId,
  readConnection,
  writeConnection,
} from '../src/services/connections/providers.ts'
import { repoPath, regsEndpoint } from '../src/services/connections/config.ts'
import { mcpClient } from '../src/services/connections/mcp.ts'
import { confirmWrite, useWriteReview } from '../src/services/connections/confirmation.ts'
function githubMock(t, onCall) {
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    assert.equal(url, 'https://api.githubcopilot.com/mcp/')
    assert.equal(init.redirect, 'error')
    const q = JSON.parse(init.body)
    if (!q.id) return new Response(null, { status: 202 })
    const result =
      q.method === 'initialize'
        ? { protocolVersion: '2025-03-26' }
        : { content: [{ type: 'text', text: JSON.stringify(onCall(q.params)) }] }
    return Response.json({ jsonrpc: '2.0', id: q.id, result })
  })
}
const config = {
  target: '145736/deepseek-go-mobile',
  token: 'test-only',
  enabled: true,
  checked: 1,
}

test('explicit targets, safe repository scope, and write intent', () => {
  assert.equal(detectConnection('@GitHub 创建一个 Issue').write, true)
  assert.equal(detectConnection('读取 Notion 页面的资料').provider, 'Notion')
  assert.equal(detectConnection('@regs 查找规定').write, false)
  assert.equal(detectConnection('公文润色'), undefined)
  assert.throws(() => repoPath('../..'))
  assert.throws(() => regsEndpoint('http://example.org/mcp'))
  assert.equal(
    pageId('https://www.notion.so/Meeting-0123456789abcdef0123456789abcdef'),
    '01234567-89ab-cdef-0123-456789abcdef'
  )
})
test('writes wait for review, cancellation makes no request, exact approved body is submitted once', async (t) => {
  const calls = []
  githubMock(t, (params) => {
    calls.push(params)
    return { url: 'https://github.com/145736/deepseek-go-mobile/issues/7' }
  })
  const draft = { provider: 'GitHub', target: config.target, title: '草稿', body: '正文' }
  const signal = new AbortController().signal
  const canceled = confirmWrite(draft, signal)
  useWriteReview.getState().review.finish(null)
  assert.equal(await canceled, null)
  assert.equal(calls.length, 0)
  const pending = confirmWrite(draft, signal)
  const review = useWriteReview.getState().review
  review.finish({ ...draft, title: '最终稿' })
  review.finish(draft)
  const receipt = await writeConnection(await pending, config)
  assert.equal(calls.length, 1)
  assert.equal(calls[0].name, 'issue_write')
  assert.deepEqual(calls[0].arguments, {
    method: 'create',
    owner: '145736',
    repo: 'deepseek-go-mobile',
    title: '最终稿',
    body: '正文',
  })
  assert.equal(receipt.label, '已创建 Issue #7')
})
test('read operations stay on the selected repository and record real sources', async (t) => {
  githubMock(t, (params) => {
    assert.equal(params.name, 'list_commits')
    assert.deepEqual(params.arguments, { owner: '145736', repo: 'deepseek-go-mobile', perPage: 8 })
    return [
      {
        commit: { message: '更新' },
        html_url: 'https://github.com/145736/deepseek-go-mobile/commit/abc',
      },
    ]
  })
  const result = await readConnection(
    'GitHub',
    config,
    '最近改了什么',
    new AbortController().signal
  )
  assert.equal(result.activities[1].label, '更新')
  assert.match(result.data, /commit\/abc/)
})
test('stateful regs sends negotiated session headers and fetches the returned source id', async (t) => {
  const methods = []
  t.mock.method(globalThis, 'fetch', async (url, init) => {
    if (init.method === 'DELETE') return new Response(null, { status: 204 })
    const q = JSON.parse(init.body)
    methods.push(q.method)
    if (q.method === 'initialize')
      return Response.json(
        { jsonrpc: '2.0', id: q.id, result: { protocolVersion: '2025-03-26' } },
        { headers: { 'mcp-session-id': 'sample-session' } }
      )
    assert.equal(init.headers.get('Mcp-Session-Id'), 'sample-session')
    if (!q.id) return new Response(null, { status: 202 })
    if (q.params.name === 'fetch') assert.equal(q.params.arguments.id, 'exact-id')
    const text =
      q.params.name === 'search'
        ? JSON.stringify({ hits: [{ id: 'exact-id', source: '文件A' }] })
        : '原文'
    const packet = { jsonrpc: '2.0', id: q.id, result: { content: [{ type: 'text', text }] } }
    return new Response('event: message\r\ndata: ' + JSON.stringify(packet) + '\r\n\r\n', {
      headers: { 'content-type': 'text/event-stream' },
    })
  })
  const result = await readConnection(
    'regs',
    { ...config, target: 'https://example.org/mcp' },
    '收费',
    new AbortController().signal
  )
  assert.match(result.data, /原文/)
  assert.equal(result.activities.length, 2)
  assert.deepEqual(methods, ['initialize', 'notifications/initialized', 'tools/call', 'tools/call'])
})
test('Notion requires a creation receipt rather than accepting tool error text as success', async (t) => {
  t.mock.method(globalThis, 'fetch', async (_, init) => {
    const q = JSON.parse(init.body)
    if (!q.id) return new Response(null, { status: 202 })
    const result =
      q.method === 'initialize'
        ? { protocolVersion: '2025-03-26' }
        : q.method === 'tools/list'
          ? { tools: [{ name: 'notion-create-pages' }] }
          : { content: [{ type: 'text', text: '{}' }] }
    return Response.json({ id: q.id, result })
  })
  await assert.rejects(
    writeConnection(
      { provider: 'Notion', title: '页', body: '文', target: '0123456789abcdef0123456789abcdef' },
      config
    ),
    /回执/
  )
})
test('remote errors cannot mark an MCP call successful', async (t) => {
  t.mock.method(globalThis, 'fetch', async () =>
    Response.json({ id: 1, result: { isError: true, content: [] } })
  )
  await assert.rejects(mcpClient('https://example.org/mcp', '').call('fetch', {}), /未成功/)
})
