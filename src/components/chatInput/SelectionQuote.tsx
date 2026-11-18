import { useEffect, useState, type RefObject } from 'react'
import { useTranslate } from '../../i18n/index.js'
import { setDraftQuote } from '../../services/chat/drafts.js'

const source = '[data-quote-source], .ds-assistant-message-main-content'
const omit = '.ds-markdown-cite,.md-code-block-banner,button,[aria-hidden="true"],script,style'
const parent = (n: Node) => (n instanceof Element ? n : n.parentElement)

function selectedPassage() {
  const selection = window.getSelection()
  if (!selection || selection.isCollapsed || selection.rangeCount !== 1) {
    return null
  }
  const range = selection.getRangeAt(0)
  const scope = parent(range.startContainer)?.closest(source)
  if (
    !scope ||
    !scope.contains(range.endContainer) ||
    parent(range.commonAncestorContainer)?.closest(omit)
  ) {
    return null
  }
  const fragment = range.cloneContents()
  fragment.querySelectorAll(omit).forEach((n) => n.remove())
  fragment.querySelectorAll('br').forEach((n) => n.replaceWith('\n'))
  fragment
    .querySelectorAll('p,li,pre,h1,h2,h3,h4,h5,h6,tr,blockquote')
    .forEach((n) => n.append('\n'))
  const text = fragment.textContent?.trim()
  if (!text) {
    return null
  }
  const rect = range.getBoundingClientRect()
  return {
    text,
    x: Math.max(48, Math.min(innerWidth - 48, rect.x + rect.width / 2)),
    y: rect.top >= 58 ? rect.top - 50 : Math.min(innerHeight - 48, rect.bottom + 4),
  }
}

export function SelectionQuote({
  sessionId,
  input,
}: {
  sessionId: string
  input: RefObject<HTMLTextAreaElement>
}) {
  const t = useTranslate()
  const [selection, setSelection] = useState<ReturnType<typeof selectedPassage>>(null)
  useEffect(() => {
    const update = () => setSelection(selectedPassage())
    document.addEventListener('selectionchange', update)
    document.addEventListener('scroll', update, true)
    window.addEventListener('resize', update)
    return () => {
      document.removeEventListener('selectionchange', update)
      document.removeEventListener('scroll', update, true)
      window.removeEventListener('resize', update)
    }
  }, [])
  if (!selection) {
    return null
  }
  const quote = () => {
    const text = selectedPassage()?.text ?? selection.text
    setDraftQuote(sessionId, text)
    window.getSelection()?.removeAllRanges()
    input.current?.focus({ preventScroll: true })
    setSelection(null)
  }
  return (
    <button
      type="button"
      className="quote-action"
      style={{ left: selection.x, top: selection.y }}
      onPointerDown={(e) => {
        if (e.button === 0) {
          e.preventDefault()
        }
      }}
      onMouseDown={(e) => e.preventDefault()}
      onClick={quote}
    >
      {t('quoteText')}
    </button>
  )
}
