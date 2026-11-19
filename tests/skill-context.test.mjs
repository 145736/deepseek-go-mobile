import assert from 'node:assert/strict'
import { test } from 'node:test'
import { toRequestMessages } from '../src/services/chat/reply.ts'
import { previousSkillAnswer, skillSystemPrompt } from '../src/services/chat/skillContext.ts'

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

test('explicit receipt queries read the saved reply without guessing from earlier answer text', () => {
  const question = { role: 'user', content: '上一轮的输出是否调用了我的公文写作skill？', files: [] }
  const history = [
    { role: 'user', mentionedSkillName: skill.name },
    { ...reply, skillMode: 'mentioned' },
  ]
  assert.match(previousSkillAnswer(history, question), /公文写作.*手动点名/)
  for (const content of ['这次是否调用了技能？', '刚才用的是哪个技能？', '这一轮用了什么技能？']) {
    assert.match(previousSkillAnswer(history, { ...question, content }), /上一轮.*公文写作/)
  }
  assert.match(
    previousSkillAnswer([{ ...reply, skillResolved: false }], question, [skill]),
    /无法判断/
  )
  assert.match(previousSkillAnswer([{ ...reply, skill: undefined }], question, [skill]), /没有附带/)
  for (const content of [
    '重新润色',
    '请使用公文写作',
    '上一轮使用了技能吗？请再润色一次',
    '刚才使用搜索工具了吗？',
  ]) {
    assert.equal(previousSkillAnswer(history, { ...question, content }), undefined)
  }
  assert.equal(previousSkillAnswer(history, { ...question, mentionedSkill: skill.id }), undefined)
})

test('the sent mention is part of the actual user message and stays attached to that history turn', () => {
  const user = {
    role: 'user',
    mentionedSkill: skill.id,
    mentionedSkillName: skill.name,
    content: '重新润色',
    files: [],
  }
  const done = { ...reply, blocks: [{ type: 'text', text: '已改稿' }] }
  const next = { role: 'user', content: '换个话题', files: [] }
  assert.equal(
    toRequestMessages([], user, undefined, false, undefined, skill.name)[0].content,
    '@公文写作\n重新润色'
  )
  const messages = toRequestMessages([user, done], next)
  assert.equal(messages[0].content, '@公文写作\n重新润色')
  assert.equal(messages.at(-1).content, '换个话题')
})
