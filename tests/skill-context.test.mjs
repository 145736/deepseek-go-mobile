import assert from 'node:assert/strict'
import { test } from 'node:test'
import { skillSystemPrompt } from '../src/services/chat/skillContext.ts'

const skill = { id: 'document', name: '公文写作', body: '本次技能的完整规则' }
const reply = { role: 'assistant', status: 'done', skillResolved: true, skill }

test('a follow-up can identify the previous skill without applying its rules again', () => {
  assert.ok(skillSystemPrompt([], skill).endsWith(skill.body))
  const followUp = skillSystemPrompt([reply])
  assert.ok(followUp.includes('上一轮回答的客户端记录：请求包含文字技能 "公文写作"'))
  assert.ok(followUp.includes('本次请求未附带文字技能规则'))
  assert.ok(!followUp.includes(skill.body))
  const next = skillSystemPrompt([reply, { ...reply, skill: undefined }], skill)
  assert.ok(next.includes('上一轮回答的客户端记录：请求未附带文字技能规则'))
  assert.ok(next.endsWith(skill.body))
})

test('older, incomplete and mixed continuation records keep their uncertainty', () => {
  for (const change of [{ skillResolved: undefined }, { status: 'stopped' }, { status: 'error' }]) {
    assert.match(skillSystemPrompt([{ ...reply, ...change }]), /没有可确认的记录/)
  }
  assert.match(skillSystemPrompt([{ ...reply, continuedWithoutSkill: true }]), /续写请求未附带/)
  assert.doesNotMatch(skillSystemPrompt([]), /上一轮回答的客户端记录/)
})
