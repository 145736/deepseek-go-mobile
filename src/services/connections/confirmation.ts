import { create } from 'zustand'
import type { WriteDraft } from './providers.js'
type Review = { draft: WriteDraft; finish: (result: WriteDraft | null) => void }
export const useWriteReview = create<{ review?: Review }>(() => ({}))
export function confirmWrite(draft: WriteDraft, signal: AbortSignal): Promise<WriteDraft | null> {
  signal.throwIfAborted()
  if (useWriteReview.getState().review) {
    throw Error('请先处理当前写入确认')
  }
  return new Promise((resolve) => {
    const cancel = () => finish(null)
    function finish(result: WriteDraft | null) {
      if (useWriteReview.getState().review?.finish !== finish) {
        return
      }
      useWriteReview.setState({ review: undefined })
      signal.removeEventListener('abort', cancel)
      resolve(result)
    }
    signal.addEventListener('abort', cancel, { once: true })
    useWriteReview.setState({ review: { draft, finish } })
  })
}
