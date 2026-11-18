import type { TextSkill } from '../skills.js'
import type { AssistantMessage, Message, UserMessage } from './types.js'

/** Only a completed reply with a resolved snapshot confirms what its request contained. */
export function confirmedSkillRequest(reply: AssistantMessage) {
  return reply.status === 'done' && reply.skillResolved === true
}

// Only answer a standalone lookup locally. Writing requests and compound questions go to the model.
export function previousSkillAnswer(
  history: Message[],
  question: UserMessage,
  catalog: readonly Pick<TextSkill, 'name'>[] = []
) {
  const previous = history.at(-1)
  if (
    previous?.role !== 'assistant' ||
    question.mentionedSkill ||
    question.quote ||
    question.files.length
  ) {
    return
  }
  const compact = (text: string) => text.toLowerCase().replace(/[\s「」“”‘’【】@]/gu, '')
  const query = compact(question.content).replace(/[？?。！!]+$/u, '')
  const subject = query.replace(/^(?:请问)?(?:你)?/u, '')
  const past =
    /^(?:上一?[轮次条]|刚才|刚刚|方才)(?:这轮|这一轮|那轮)?(?:的)?(?:输出|回答|回复|润色)?(?:中|时)?/u
  const rest = subject.replace(past, '').replace(/^你(?:到底|真的)?/u, '')
  const asksWhether =
    /^(?:是否|有没有|有无)/u.test(rest) || /(?:了吗|过吗|了没|了没有|吗|么)$/u.test(rest)
  if (!asksWhether && !past.test(subject)) {
    return
  }
  const action = /^(?:是否|有没有|有无|有)?(?:调用|使用|用到|用上|用|启用|应用)(?:了|过)?/u.exec(
    rest
  )
  if (!action) {
    return
  }
  const target = rest
    .slice(action[0].length)
    .replace(/(?:了吗|过吗|了没有|没有|了没|吗|了|么)$/u, '')
    .replace(/^(?:我的?|那个|这个)/u, '')
  const lastUser = history.at(-2)
  const names = [
    previous.skill?.name,
    lastUser?.role === 'user' ? lastUser.mentionedSkillName : undefined,
  ]
  const generic = /^(?:哪个|什么|哪些)?(?:文字)?(?:技能|skills?)$/u.test(target)
  const named = names
    .concat(catalog.map((item) => item.name))
    .some(
      (name) => name && ['', 'skill', '技能'].some((suffix) => target === compact(name) + suffix)
    )
  if (!(generic || named || (past.test(subject) && !target && previous.skill))) {
    return
  }
  if (!confirmedSkillRequest(previous)) {
    return '本机记录：上一轮缺少可确认的技能发送记录，无法判断是否附带了技能规则。'
  }
  if (previous.localSkillReceipt) {
    return '本机记录：上一条回答是本机的记录查询，没有发送模型请求。'
  }
  if (!previous.skill) {
    return '本机记录：上一轮发送给 DeepSeek 的请求没有附带文字技能规则。'
  }
  const mode =
    previous.skillMode === 'mentioned'
      ? '（手动点名）'
      : previous.skillMode === 'auto'
        ? '（自动匹配）'
        : ''
  const note = previous.continuedWithoutSkill ? '这条回答后续有一次续写未附带该技能。' : ''
  return `本机记录：上一轮发送给 DeepSeek 的请求附带了「${previous.skill.name}」的完整规则${mode}。${note}`
}

export function skillSystemPrompt(history: Message[], current?: TextSkill) {
  const parts = ['该助手为DeepSeek，由深度求索公司创造。']
  const previous = history.at(-1)
  if (previous?.role === 'assistant') {
    let record = '没有可确认的记录。'
    if (confirmedSkillRequest(previous)) {
      if (previous.localSkillReceipt) {
        record = '上一条是客户端根据已保存记录给出的回复，没有发送模型请求。'
      } else if (previous.skill) {
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
    parts.push(
      '本次请求附带的文字技能：' +
        JSON.stringify(current.name) +
        '。请按以下规则完成当前任务；先前回答中关于是否使用技能的推测不影响本次选择。',
      current.body
    )
  } else {
    parts.push('本次请求未附带文字技能规则。')
  }
  return parts.join('\n\n')
}
