import { test } from 'node:test'
import assert from 'node:assert/strict'
import { generationOptions } from '../src/services/chat/generationOptions.ts'

test('Flash uses the saved effort without losing web tools or title generation', () => {
  for (const effort of ['low', 'high', 'max']) {
    const options = generationOptions(
      { model: 'deepseek-flash', thinking: true, effort, search: true },
      true
    )
    assert.equal(options.output_config.effort, effort)
    assert.deepEqual(
      options.tools.map((tool) => tool.type),
      ['deepseek_read_url', 'deepseek_web_search']
    )
    assert.equal(options.title.enabled, true)
  }
})
test('Pro plain text requests omit Flash tools, title and inactive effort', () => {
  const options = generationOptions(
    { model: 'deepseek-v4-pro', thinking: false, effort: 'max', search: true },
    true
  )
  assert.deepEqual(options, { model: 'deepseek-v4-pro', thinking: { type: 'disabled' } })
})
test('continuation from older local records uses Flash and high when thinking is enabled', () => {
  const options = generationOptions({ model: null, thinking: true }, false)
  assert.equal(options.model, 'deepseek-flash')
  assert.equal(options.output_config.effort, 'high')
})
