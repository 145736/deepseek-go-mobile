import { SelectionQuote } from './SelectionQuote.js'
import { useSkillMention } from './useSkillMention.js'
import { detectConnection } from '../../services/connections/providers.js'
import { useConnections } from '../../services/connections/config.js'
import { useSkills } from '../../services/skills.js'
import clsx from 'clsx'
import { memo, useCallback, useEffect, useRef, useState } from 'react'
import { IconGlobeLanguageOutline14, IconSendOutline16, IconStopFill16 } from '../base/icons.js'
import { requireFlash, setSearch, useSettings } from '../../services/settings.js'
import { useIsMobile } from '../../app/viewport.js'
import { sendMessage, stopReply, useChatStore } from '../../services/chat/store.js'
import {
  addDraftFiles,
  EMPTY_DRAFT,
  getDraft,
  prepareDraftMessage,
  removeDraftAttachment,
  retryDraftAttachment,
  setDraftText,
  setDraftQuote,
  setDraftSkill,
  useDrafts,
} from '../../services/chat/drafts.js'
import { stopReadAloud } from '../../services/speech/readAloud.js'
import { ReasoningControl } from './ReasoningControl.js'
import { ModelControls } from './ModelControls.js'
import { Tooltip } from '../base/Tooltip.js'
import { ensureApiKey } from '../settings/settingsDialogState.js'
import { DragMask, useFileDrop } from './DragMask.js'
import { showToast } from '../base/toastState.js'
import { ACCEPT, useUploads } from '../../services/attachments.js'
import { DraftAttachments } from './DraftAttachments.js'
import { useVoiceInput } from './useVoiceInput.js'
import { VoiceButton } from './VoiceButton.js'
import { Spectrum } from './Spectrum.js'
import { useTranslate } from '../../i18n/index.js'
import styles from './ChatInput.module.css'

/** 输入框：自适应高度的文本框 + 文件 + 深度思考与智能搜索开关 + 语音输入 + 发送 / 停止 */
export const ChatInput = memo(function ChatInput({ sessionId }: { sessionId: string | null }) {
  // 切换目标时释放录音、转写和 DOM 状态；文字与附件由草稿服务保留。
  return <Input key={sessionId === null ? 'new' : `session:${sessionId}`} sessionId={sessionId} />
})

const Input = ({ sessionId }: { sessionId: string | null }) => {
  const t = useTranslate()
  const draft = useDrafts((state) => state.drafts.get(sessionId) ?? EMPTY_DRAFT)
  const { text, attachments } = draft
  const setText = (value: string) => setDraftText(sessionId, value)
  const draftReady = useUploads((state) => prepareDraftMessage(draft, state.tasks) !== null)
  const streaming = useChatStore(
    (state) => sessionId !== null && Object.hasOwn(state.streaming, sessionId)
  )
  const thinking = useSettings((state) => state.thinking)
  const importingHistory = useChatStore((state) => state.importingHistory)
  const isMobile = useIsMobile()
  const [editing, setEditing] = useState(false)
  const search = useSettings((state) => state.model === 'deepseek-flash' && state.search)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const mention = useSkillMention(sessionId, text, textareaRef)
  const chosen = useSkills((library) =>
    draft.skillRef ? library.items.find((item) => library.choices[item.id] === draft.skillRef) : undefined
  )
  useEffect(() => {
    if (draft.skillRef && !chosen) {
      setDraftSkill(sessionId)
    }
  }, [chosen, draft.skillRef, sessionId])
  // Safari can dismiss its keyboard while leaving the textarea focused.
  useEffect(() => {
    const viewport = window.visualViewport
    if (!isMobile || !editing || !viewport) {
      return
    }
    let keyboardVisible = false
    const trackKeyboard = () => {
      if (viewport.scale !== 1) {
        return
      }
      const covered = window.innerHeight - viewport.height
      if (covered > 140) {
        keyboardVisible = true
      } else if (
        keyboardVisible &&
        covered < 60 &&
        document.activeElement === textareaRef.current
      ) {
        textareaRef.current?.blur()
      }
    }
    trackKeyboard()
    viewport.addEventListener('resize', trackKeyboard)
    return () => viewport.removeEventListener('resize', trackKeyboard)
  }, [editing, isMobile])
  const acceptFiles = (files: File[]) => {
    if (
      files.length === 0 ||
      useChatStore.getState().importingHistory ||
      !requireFlash(() => acceptFiles(files)) ||
      !ensureApiKey()
    ) {
      return
    }
    const error = addDraftFiles(sessionId, files, useSettings.getState().apiKey ?? '')
    if (error) {
      showToast(error)
    }
  }
  const retryFile = useCallback(
    (id: string) => {
      if (!useChatStore.getState().importingHistory && ensureApiKey()) {
        retryDraftAttachment(sessionId, id, useSettings.getState().apiKey ?? '')
      }
    },
    [sessionId]
  )
  const removeFile = useCallback(
    (id: string) => {
      if (!useChatStore.getState().importingHistory) {
        removeDraftAttachment(sessionId, id)
      }
    },
    [sessionId]
  )
  const dragging = useFileDrop(acceptFiles)

  /** 转写结果插入到光标处，并把光标移到插入内容之后 */
  const voice = useVoiceInput((transcript) => {
    const textarea = textareaRef.current
    const current = getDraft(sessionId).text
    const start = textarea?.selectionStart ?? current.length
    const end = textarea?.selectionEnd ?? current.length
    setText(current.slice(0, start) + transcript + current.slice(end))
    requestAnimationFrame(() => {
      textarea?.focus({ preventScroll: true })
      textarea?.setSelectionRange(start + transcript.length, start + transcript.length)
    })
  })

  // 欢迎页导入后会话 ID 不变，不能依赖卸载取消语音；订阅开始事件也覆盖快速完成的导入。
  const cancelVoice = voice.cancel
  useEffect(
    () =>
      useChatStore.subscribe((state, previous) => {
        if (state.importingHistory && !previous.importingHistory) {
          cancelVoice()
        }
      }),
    [cancelVoice]
  )

  // 移动端录音时用频谱替代输入框内容
  const recording = voice.status === 'recording'

  // 排队、上传中或上传失败的附件都留在输入框，全部上传成功后才能发送
  const canSend = !importingHistory && !streaming && voice.status === 'idle' && draftReady

  const compact = !chosen && !draft.quote && !editing && !text && !attachments.length && !streaming && voice.status === 'idle'

  const send = () => {
    if (
      useChatStore.getState().importingHistory ||
      voice.status !== 'idle' ||
      !prepareDraftMessage(getDraft(sessionId), useUploads.getState().tasks)
    ) {
      return
    }
    // 文本与上传完成态由提交动作读取最新快照，不使用上一次渲染的草稿。
    const connection = detectConnection(getDraft(sessionId).text)
    const directWrite = connection?.write && (connection.explicit || useConnections.getState()[connection.provider].enabled)
    if ((!directWrite && !connection?.stars && !ensureApiKey()) || !sendMessage(sessionId)) {
      return
    }
    stopReadAloud()
    if (isMobile) {
      textareaRef.current?.blur()
    } else {
      textareaRef.current?.focus()
    }
  }

  return (
    <div
      className={clsx(styles.wrapper, sessionId === null ? styles.home : styles.session)}
      data-compact={compact}
      onBlurCapture={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) {
          setEditing(false)
        }
      }}
      onMouseDown={(event) => {
        if (
          document.activeElement === textareaRef.current &&
          event.target instanceof Element &&
          event.target.closest('button')
        ) {
          event.preventDefault()
        }
      }}
      onClick={(event) => {
        if (event.target === event.currentTarget) {
          textareaRef.current?.focus({ preventScroll: true })
        }
      }}
    >
      {mention.menu}
      {chosen && (
        <div className="skill-mention-chip">
          <span>@{chosen.name}</span>
          <button type="button" aria-label={t('removeMention')} onClick={() => setDraftSkill(sessionId)}>
            ×
          </button>
        </div>
      )}
      {sessionId && <SelectionQuote key={sessionId} sessionId={sessionId} input={textareaRef} />}
      {sessionId && draft.quote && <div className="draft-quote">
        <span aria-hidden="true">❝</span><span>{draft.quote}</span>
        <button type="button" aria-label={t('removeQuote')} onClick={()=>setDraftQuote(sessionId)}>×</button>
      </div>}
      <DraftAttachments items={attachments} onRetry={retryFile} onRemove={removeFile} />
      <div className={styles.textareaWrapper}>
        <textarea
          ref={textareaRef}
          className={clsx(styles.textarea, recording && isMobile && styles.textareaHidden)}
          placeholder={t('chatInputPlaceholderChat')}
          rows={1}
          aria-label={t('chatInputPlaceholderChat')}
          onFocus={() => setEditing(true)}
          // 移动端不自动聚焦，避免一打开就弹出键盘
          autoFocus={!isMobile}
          disabled={importingHistory}
          value={text}
          aria-autocomplete="list"
          aria-controls={mention.listId}
          aria-activedescendant={mention.activeId}
          onSelect={(event) => mention.update(event.currentTarget)}
          onBlur={mention.close}
          onChange={(event) => {
            setText(event.target.value)
            mention.update(event.currentTarget)
          }}
          onMouseDown={(event) => {
            // 首次点击时手动聚焦，避免 Safari 把整个页面滚到输入框位置。
            if (isMobile && event.button === 0 && document.activeElement !== event.currentTarget) {
              event.preventDefault()
              event.currentTarget.focus({ preventScroll: true })
            }
          }}
          onKeyDown={(event) => {
            if (mention.keyDown(event)) {
              return
            }
            if (
              !isMobile &&
              event.key === 'Enter' &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing &&
              event.nativeEvent.keyCode !== 229
            ) {
              event.preventDefault()
              send()
            }
          }}
          onPaste={(event) => {
            const files = Array.from(event.clipboardData.files)
            if (files.length > 0) {
              event.preventDefault()
              acceptFiles(files)
            }
          }}
        />
        {recording && isMobile ? <Spectrum getAnalyser={voice.getAnalyser} /> : null}
        <div className={styles.mirror} aria-hidden>
          {`${text}\n`}
        </div>
      </div>
      <div className={styles.functionRow}>
        <ModelControls
          disabled={importingHistory}
          plusClass={styles.plus}
          onUpload={() => {
            const pick = () => {
              if (ensureApiKey()) {
                fileInputRef.current?.click()
              }
            }
            if (requireFlash(pick)) {
              pick()
            }
          }}
        />
        <input
          ref={fileInputRef}
          type="file"
          multiple
          hidden
          accept={ACCEPT}
          onChange={(event) => {
            acceptFiles(Array.from(event.target.files ?? []))
            event.target.value = ''
          }}
        />
        <div className={styles.toggles}>
          <Tooltip content={t(search ? 'searchOn' : 'searchOff')}>
            <button
              type="button"
              data-search-toggle=""
              className={clsx(styles.toggle, search && styles.selected)}
              aria-label={t('search')}
              aria-pressed={search}
              onClick={() => {
                if (requireFlash(() => setSearch(true))) {
                  setSearch(!search)
                }
              }}
            >
              <IconGlobeLanguageOutline14 />
            </button>
          </Tooltip>
          <ReasoningControl className={clsx(styles.toggle, thinking && styles.selected)} />
        </div>
        <div className={styles.right}>
          <VoiceButton
            status={voice.status}
            disabled={!voice.available}
            seconds={voice.seconds}
            onClick={() => {
              if (
                voice.status !== 'idle' ||
                (!useChatStore.getState().importingHistory && ensureApiKey())
              ) {
                void voice.toggle()
              }
            }}
          />
          {streaming && sessionId ? (
            <button
              type="button"
              className={styles.sendButton}
              aria-label={t('chatInputStopButtonTooltip')}
              onClick={() => {
                stopReadAloud()
                stopReply(sessionId)
              }}
            >
              <IconStopFill16 />
            </button>
          ) : (
            <button
              type="button"
              className={clsx(styles.sendButton, !canSend && styles.disabled)}
              aria-label={t('send')}
              aria-disabled={!canSend}
              onClick={send}
            >
              <IconSendOutline16 />
            </button>
          )}
        </div>
      </div>
      {dragging ? <DragMask /> : null}
    </div>
  )
}
