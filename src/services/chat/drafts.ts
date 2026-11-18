import { create } from 'zustand'
import type { TranslationMessage } from '../../i18n/index.js'
import { createId } from '../../utils/id.js'
import {
  cancelUpload,
  isImage,
  resolveMimeType,
  uploadAttachment,
  validateFiles,
  type UploadTask,
} from '../attachments.js'
import type { FileAttachment } from './types.js'

export type DraftAttachment = {
  /** 本地标识，也是 IndexedDB 原件与上传任务的 key */
  id: string
  file: File
  isImage: boolean
  previewUrl: string | null
}

type Draft = { text: string; quote?: string; skillRef?: string; attachments: DraftAttachment[] }

export const EMPTY_DRAFT: Draft = { text: '', attachments: [] }

// Persist text per conversation. Attachment blobs and upload tasks stay in memory.
const textKey = 'chat-demo:draft-text:'
const quoteKey = 'chat-demo:draft-quote:'
const mentionKey = 'chat-demo:draft-mention:'
function restoreText() {
  const drafts = new Map<string | null, Draft>()
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      const prefix = key?.startsWith(mentionKey) ? mentionKey : key?.startsWith(quoteKey) ? quoteKey : textKey
      if (!key?.startsWith(prefix)) {
        continue
      }
      const id = key.slice(prefix.length)
      const text = localStorage.getItem(key)
      if (text) {
        drafts.set(id || null, {
          ...(drafts.get(id || null) ?? EMPTY_DRAFT),
          [prefix === mentionKey ? 'skillRef' : prefix === quoteKey ? 'quote' : 'text']: text,
        })
      }
    }
  } catch {
    /* Storage may be unavailable in private browsing. */
  }
  return drafts
}
function saveText(sessionId: string | null, text: string, prefix = textKey) {
  const key = prefix + (sessionId ?? '')
  try {
    if (text) {
      localStorage.setItem(key, text)
    } else {
      localStorage.removeItem(key)
    }
  } catch {
    /* Keep editing in memory when storage is full. */
  }
}
export const useDrafts = create<{ drafts: Map<string | null, Draft> }>(() => ({
  drafts: restoreText(),
}))

export const getDraft = (sessionId: string | null): Draft =>
  useDrafts.getState().drafts.get(sessionId) ?? EMPTY_DRAFT

const updateDraft = (sessionId: string | null, update: (draft: Draft) => Draft) =>
  useDrafts.setState((state) => {
    const draft = update(state.drafts.get(sessionId) ?? EMPTY_DRAFT)
    if (draft.text !== state.drafts.get(sessionId)?.text) {
      saveText(sessionId, draft.text)
    }
    if (draft.quote !== state.drafts.get(sessionId)?.quote) {
      saveText(sessionId, draft.quote ?? '', quoteKey)
    }
    if (draft.skillRef !== state.drafts.get(sessionId)?.skillRef) {saveText(sessionId, draft.skillRef ?? '', mentionKey)}
    const drafts = new Map(state.drafts)
    if (draft.text || draft.quote || draft.skillRef || draft.attachments.length > 0) {
      drafts.set(sessionId, draft)
    } else {
      drafts.delete(sessionId)
    }
    return { drafts }
  })

export const setDraftSkill = (id: string | null, skillRef?: string) =>
  updateDraft(id, draft => ({...draft, skillRef}))

export const setDraftQuote = (id: string, quote?: string) =>
  updateDraft(id, (draft) => ({ ...draft, quote }))

export const setDraftText = (sessionId: string | null, text: string) =>
  updateDraft(sessionId, (draft) => ({ ...draft, text }))

const upload = (attachment: DraftAttachment, apiKey: string) => {
  // 上传任务负责记录错误，输入框的附件卡片展示失败及重试入口。
  void uploadAttachment(
    apiKey,
    attachment.id,
    attachment.file,
    attachment.file.name,
    attachment.isImage
  ).catch(() => {})
}

/** 整批校验通过后才创建预览和开始上传。 */
export const addDraftFiles = (
  sessionId: string | null,
  files: File[],
  apiKey: string
): TranslationMessage | null => {
  if (files.length === 0) {
    return null
  }
  const error = validateFiles(files, getDraft(sessionId).attachments.length)
  if (error) {
    return error
  }
  const added = files.map((file): DraftAttachment => {
    const image = isImage(resolveMimeType(file))
    return {
      id: createId(),
      file,
      isImage: image,
      previewUrl: image ? URL.createObjectURL(file) : null,
    }
  })
  updateDraft(sessionId, (draft) => ({ ...draft, attachments: [...draft.attachments, ...added] }))
  added.forEach((attachment) => upload(attachment, apiKey))
  return null
}

export const retryDraftAttachment = (
  sessionId: string | null,
  attachmentId: string,
  apiKey: string
) => {
  const attachment = getDraft(sessionId).attachments.find((item) => item.id === attachmentId)
  if (attachment) {
    upload(attachment, apiKey)
  }
}

/** 发送按钮和实际提交共用规则：有内容，且全部附件已上传成功。 */
export const prepareDraftMessage = (draft: Draft, tasks: Record<string, UploadTask>) => {
  const text = draft.text.trim()
  if (!text && draft.attachments.length === 0) {
    return null
  }
  const files: (FileAttachment & { serverId: string; blob: Blob })[] = []
  for (const attachment of draft.attachments) {
    const task = tasks[attachment.id]
    if (task?.status !== 'done' || !task.serverId) {
      return null
    }
    files.push({
      id: attachment.id,
      serverId: task.serverId,
      name: attachment.file.name,
      size: attachment.file.size,
      isImage: attachment.isImage,
      mimeType: resolveMimeType(attachment.file),
      blob: attachment.file,
    })
  }
  return { text, files, quote: draft.quote }
}

const releaseAttachment = (attachment: DraftAttachment, cancel: boolean) => {
  if (cancel) {
    cancelUpload(attachment.id)
  }
  if (attachment.previewUrl) {
    URL.revokeObjectURL(attachment.previewUrl)
  }
}

export const removeDraftAttachment = (sessionId: string | null, attachmentId: string) => {
  const attachment = getDraft(sessionId).attachments.find((item) => item.id === attachmentId)
  if (!attachment) {
    return
  }
  releaseAttachment(attachment, true)
  updateDraft(sessionId, (draft) => ({
    ...draft,
    attachments: draft.attachments.filter((item) => item.id !== attachmentId),
  }))
}

/** 发送成功后原件与 serverId 已交给会话，释放预览但保留上传完成态。 */
export const clearSentDraft = (sessionId: string | null) => {
  getDraft(sessionId).attachments.forEach((attachment) => releaseAttachment(attachment, false))
  updateDraft(sessionId, () => EMPTY_DRAFT)
}

/** 删除会话或替换历史成功后，释放尚未发送的草稿及上传任务。 */
export const clearDraft = (sessionId: string | null) => {
  getDraft(sessionId).attachments.forEach((attachment) => releaseAttachment(attachment, true))
  updateDraft(sessionId, () => EMPTY_DRAFT)
}

export const clearAllDrafts = () => {
  for (const [id, draft] of useDrafts.getState().drafts) {
    saveText(id, '')
    saveText(id, '', quoteKey)
    saveText(id, '', mentionKey)
    draft.attachments.forEach((attachment) => releaseAttachment(attachment, true))
  }
  useDrafts.setState({ drafts: new Map() })
}
