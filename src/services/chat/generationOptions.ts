import type { CreateMessageRequest } from '../api/types.js'
import type { AssistantMessage } from './types.js'

type Snapshot = Pick<AssistantMessage, 'model' | 'thinking' | 'effort' | 'search'>
type Options = Omit<CreateMessageRequest, 'system' | 'messages' | 'safety_check'>

export function generationOptions(
  snapshot: Snapshot,
  needsTitle: boolean,
  allowWebTools = true
): Options {
  const model = snapshot.model ?? 'deepseek-flash'
  const options: Options = {
    model,
    thinking: { type: snapshot.thinking ? 'enabled' : 'disabled' },
  }
  if (snapshot.thinking) {
    options.output_config = { effort: snapshot.effort ?? 'high' }
  }
  if (model === 'deepseek-flash') {
    if (allowWebTools) {
      options.tools = [{ type: 'deepseek_read_url', name: 'deepseek_read_url' }]
      if (snapshot.search) {
        options.tools.push({ type: 'deepseek_web_search', name: 'deepseek_web_search' })
      }
    }
    if (needsTitle) {
      options.title = { enabled: true }
    }
  }
  return options
}
