import { confirmWrite } from './confirmation.js'
import { useConnections } from './config.js'
import {
  detectConnection,
  readConnection,
  requireConnection,
  writeConnection,
  type Activity,
} from './providers.js'
import type { Message, UserMessage } from '../chat/types.js'

export type TaskResult = { activities: Activity[]; data?: string; reply?: string }
export async function runConnectionTask(
  question: UserMessage,
  previous: Message | undefined,
  signal: AbortSignal
): Promise<TaskResult | undefined> {
  const intent = detectConnection(question.content)
  if (!intent || (!intent.explicit && !useConnections.getState()[intent.provider].enabled)) {
    return
  }
  const { provider, task, write } = intent
  let submitting = false
  try {
    const config = requireConnection(provider)
    if (write && provider !== 'regs') {
      const lastText =
        previous?.role === 'assistant'
          ? previous.blocks.flatMap((b) => (b.type === 'text' ? [b.text] : [])).join('\n')
          : ''
      const supplied = task.match(/(?:正文[：:]\s*|\n\s*\n)([\s\S]+)/)?.[1]
      const draft = await confirmWrite(
        {
          provider,
          target: config.target,
          title: '',
          body: question.quote || supplied || lastText || task,
        },
        signal
      )
      if (!draft) {
        return { activities: [], reply: '已取消，没有提交写入。' }
      }
      signal.throwIfAborted()
      const current = requireConnection(provider)
      if (current.token !== config.token || current.target !== config.target) {
        throw Error('连接已变更，请重新确认')
      }
      submitting = true
      const activity = await writeConnection(draft, current)
      return { activities: [activity], reply: activity.label }
    }
    return await readConnection(provider, config, task, signal)
  } catch (error) {
    let message = error instanceof Error ? error.message : '连接失败'
    if (submitting) {
      message += '。请先到目标位置核对结果，再决定是否重新提交。'
    } else if (error instanceof TypeError) {
      message += '。请检查网络，以及服务是否允许随行网页跨域直连。'
    }
    return {
      activities: [],
      reply: signal.aborted && !submitting ? '已停止。' : provider + '：' + message,
    }
  }
}
