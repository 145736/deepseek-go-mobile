import assert from 'node:assert/strict'
import { test } from 'node:test'
import { matchSkill } from '../src/services/chat/matchSkill.ts'
import { defaultSkill, useSkills } from '../src/services/skills.ts'

const question = { content: '整理讨论结论', files: [{ name: '讨论.txt' }] }
const signal = new AbortController().signal

test('skill routing sends only enabled descriptions and accepts only one valid number', async (t) => {
  const disabled = { ...defaultSkill, id: 'other', name: 'other' }
  const original = useSkills.getState()
  t.after(() => useSkills.setState(original))
  useSkills.setState({
    items: [defaultSkill, disabled],
    choices: { [defaultSkill.id]: 'enabled-ref', other: '' },
  })
  let output = '1'
  const fetch = t.mock.method(globalThis, 'fetch', async (url, init) => {
    assert.equal(url, 'https://api.deepseek.com/anthropic/v1/messages')
    const body = JSON.parse(init.body)
    assert.equal(body.model, 'deepseek-flash')
    assert.equal(body.tools, undefined)
    assert.equal(JSON.stringify(body).includes(defaultSkill.body), false)
    const catalog = JSON.parse(body.messages[0].content)
    assert.deepEqual(catalog.skills, [
      { number: 1, name: defaultSkill.name, description: defaultSkill.description },
    ])
    assert.deepEqual(catalog.files, ['讨论.txt'])
    const events = [
      { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } },
      { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: output } },
      { type: 'message_stop' },
    ]
    return new Response(events.map((event) => 'data: ' + JSON.stringify(event) + '\n\n').join(''), {
      headers: { 'content-type': 'text/event-stream' },
    })
  })
  assert.deepEqual(await matchSkill('test', question, signal), { ref: 'enabled-ref' })
  output = '0'
  assert.deepEqual(await matchSkill('test', question, signal), {})
  for (output of ['2', '1 and 2', '']) {
    assert.deepEqual(await matchSkill('test', question, signal), { skipped: true })
  }
  useSkills.setState({ choices: {} })
  assert.deepEqual(await matchSkill('test', question, signal), {})
  assert.equal(fetch.mock.callCount(), 5)
})
