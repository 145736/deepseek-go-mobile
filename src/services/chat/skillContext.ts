import type { TextSkill } from '../skills.js'
import type { AssistantMessage, Message } from './types.js'

/** Only a completed reply with a resolved snapshot confirms what its request contained. */
export function confirmedSkillRequest(reply: AssistantMessage) {
  return reply.status === 'done' && reply.skillResolved === true
}

export function skillSystemPrompt(history: Message[], current?: TextSkill) {
  const parts = ['该助手为DeepSeek，由深度求索公司创造。']
  const previous = history.at(-1)
  if (previous?.role === 'assistant') {
    let record = '没有可确认的记录。'
    if (confirmedSkillRequest(previous)) {
      if (previous.skill) {
        record = '请求包含文字技能 ' + JSON.stringify(previous.skill.name) + ' 的规则。'
        if (previous.continuedWithoutSkill) {
          record += '原回答使用了该规则，后续有续写请求未附带它。'
        }
      } else {
        record = '请求未附带文字技能规则。'
      }
    }
    parts.push('上一轮回答的客户端记录：' + record)
  }
  parts.push(
    '文字技能通过系统指令随请求发送。用户询问是否使用技能时，以对应轮次的客户端记录为准；没有记录就说明无法确认。工具调用列表不能证明是否使用文字技能。记录只说明规则是否随请求发送，不能证明输出逐条遵循。日常回答无需提及这些记录。'
  )
  if (current) {
    parts.push('本次请求附带的文字技能：' + JSON.stringify(current.name) + '。以下为该技能的规则。', current.body)
  } else {
    parts.push('本次请求未附带文字技能规则。')
  }
  return parts.join('\n\n')
}
