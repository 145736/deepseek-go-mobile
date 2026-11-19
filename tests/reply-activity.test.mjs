import assert from 'node:assert/strict'
import { test } from 'node:test'
import { buildReplyView, getAreaTitle, getTotalThinkingSeconds } from '../src/services/chat/view.ts'

const tool = (id, kind, input) => ({ type: 'server_tool_use', id, kind, input })
const search = (id) => tool(id, 'search', { action: 'search', queries: [id] })
const read = tool('page', 'read_link', { action: 'read_link', url: 'https://example.org/news' })
const result = {
  type: 'web_fetch_tool_result',
  tool_use_id: 'page',
  content: { type: 'web_fetch_result', url: read.input.url, content: { title: '简报' } },
}

test('activity follows actual requests in order and retains past link reads', () => {
  const reply = { blocks: [search('first'), read, result, search('second')] }
  const view = buildReplyView(reply, true)
  assert.deepEqual(
    view.steps.map((s) => s.type),
    ['search', 'read_link', 'search']
  )
  assert.equal(view.steps[1].links[0].status, 'done')
  assert.match(getAreaTitle(view, true, reply), /second/)
  assert.match(getAreaTitle(buildReplyView({ blocks: [read] }, true), true, reply), /example.org/)
  assert.equal(buildReplyView({ blocks: [read] }, false).steps[0].links[0].status, 'failed')
  assert.equal(
    buildReplyView({ blocks: [read], status: 'stopped' }, false).steps[0].links[0].status,
    'stopped'
  )
  assert.equal(buildReplyView({ blocks: [], search: true }, false).steps.length, 0)
})

test('elapsed time requires recorded thinking, and stopped replies retain their state', () => {
  assert.equal(getTotalThinkingSeconds([]), null)
  const thinking = { type: 'thinking', thinking: '检查材料', startedAt: 1000, endedAt: 16000 }
  const view = buildReplyView({ blocks: [thinking, { type: 'text', text: '简报' }] }, false)
  assert.equal(getTotalThinkingSeconds(view.steps), 15)
  assert.equal(getTotalThinkingSeconds([{ type: 'thinking', blocks: [{ startedAt: 1000 }] }]), null)
  assert.notEqual(getAreaTitle(view, true, {}), getAreaTitle(view, false, { status: 'done' }))
  assert.notEqual(
    getAreaTitle(view, false, { status: 'stopped' }),
    getAreaTitle(view, false, { status: 'done' })
  )
})
