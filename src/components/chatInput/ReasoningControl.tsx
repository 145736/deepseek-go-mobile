import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties } from 'react'
import { useTranslate } from '../../i18n/index.js'
import { setReasoningLevel, setThinking, useSettings } from '../../services/settings.js'
import { IconCloseFill14 } from '../base/icons.js'
import styles from './ModelControls.module.css'

const levels = ['low', 'high', 'max'] as const
const labels = ['effortLow', 'effortHigh', 'effortMax'] as const

export function ReasoningControl({ className }: { className: string }) {
  const t = useTranslate()
  const thinking = useSettings((state) => state.thinking)
  const effort = useSettings((state) => state.effort)
  const index = levels.indexOf(effort)
  const [open, setOpen] = useState(false)
  const id = useId()
  const trigger = useRef<HTMLButtonElement>(null)
  const range = useRef<HTMLInputElement>(null)
  const timer = useRef(0)
  const start = useRef<{ x: number; y: number } | null>(null)
  const suppressTap = useRef(false)
  const keepDraftFocus = useRef(false)
  const stopHold = () => {
    clearTimeout(timer.current)
    start.current = null
  }

  function show(keyboard = false) {
    keepDraftFocus.current = !keyboard && document.activeElement instanceof HTMLTextAreaElement
    setOpen(true)
  }
  function dismiss() {
    setOpen(false)
    if (!keepDraftFocus.current) {
      trigger.current?.focus({ preventScroll: true })
    }
  }
  useLayoutEffect(() => {
    if (open && !keepDraftFocus.current) {
      range.current?.focus({ preventScroll: true })
    }
  }, [open])
  useEffect(() => stopHold, [])
  useEffect(() => {
    if (!open) {
      return
    }
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault()
        dismiss()
      }
    }
    document.addEventListener('keydown', escape)
    return () => document.removeEventListener('keydown', escape)
  }, [open])

  // Native keyboard and assistive controls use the range. Pointer input also keeps
  // Safari's text selection and keyboard while the thumb is being dragged.
  function chooseAt(clientX: number, input: HTMLInputElement) {
    const rect = input.getBoundingClientRect()
    const radius = parseFloat(getComputedStyle(input).getPropertyValue('--thumb-size')) / 2
    const fraction = (clientX - rect.left - radius) / (rect.width - 2 * radius)
    setReasoningLevel(levels[Math.min(2, Math.max(0, Math.round(fraction * 2)))])
  }

  return (
    <>
      <button
        type="button"
        ref={trigger}
        className={className}
        aria-label={t('thinkingSwitch')}
        title={t('reasoningGesture')}
        aria-pressed={thinking}
        aria-haspopup="dialog"
        aria-controls={open ? id : undefined}
        aria-expanded={open}
        aria-keyshortcuts="ArrowUp"
        onPointerDown={(event) => {
          if (!event.isPrimary || event.button !== 0) {
            return
          }
          stopHold()
          suppressTap.current = false
          if (document.activeElement instanceof HTMLTextAreaElement) {
            event.preventDefault()
          }
          event.currentTarget.setPointerCapture(event.pointerId)
          start.current = { x: event.clientX, y: event.clientY }
          timer.current = window.setTimeout(() => {
            suppressTap.current = true
            show()
          }, 420)
        }}
        onPointerMove={(event) => {
          if (
            start.current &&
            Math.hypot(event.clientX - start.current.x, event.clientY - start.current.y) > 10
          ) {
            stopHold()
            suppressTap.current = true
          }
        }}
        onPointerUp={stopHold}
        onPointerCancel={() => {
          suppressTap.current = true
          stopHold()
        }}
        onLostPointerCapture={stopHold}
        onContextMenu={(event) => {
          event.preventDefault()
          stopHold()
          suppressTap.current = true
          show()
        }}
        onKeyDown={(event) => {
          if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
            event.preventDefault()
            show(true)
          }
        }}
        onClick={(event) => {
          if (!open && (!suppressTap.current || event.detail === 0)) {
            setThinking(!thinking)
          }
          suppressTap.current = false
        }}
      >
        <svg
          viewBox="0 0 24 24"
          width="22"
          height="22"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          aria-hidden="true"
        >
          <path d="M4.5 19.1a9.6 9.6 0 1 1 15 0" />
          <g transform={`rotate(${thinking ? (index - 1) * 52 : -70} 12 13)`}>
            <path d="M12 10.7V6.8" />
            <circle cx="12" cy="13" r="2.1" />
          </g>
        </svg>
      </button>
      <button type="button" className={styles.access} onClick={() => show(true)}>
        {t('effortChoice')}
      </button>
      {open && (
        <>
          <div
            className={styles.dismiss}
            aria-hidden="true"
            onPointerDown={(event) => event.preventDefault()}
            onClick={dismiss}
          />
          <div
            className={styles.effortSheet}
            role="dialog"
            aria-label={t('effortChoice')}
            id={id}
            onMouseDown={(event) => {
              if (keepDraftFocus.current) {
                event.preventDefault()
              }
            }}
            onBlur={(event) => {
              if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) {
                setOpen(false)
              }
            }}
          >
            <div className={styles.level}>{t(labels[index])}</div>
            <button
              type="button"
              className={styles.close}
              aria-label={t('close')}
              onClick={dismiss}
            >
              <IconCloseFill14 />
            </button>
            <div className={styles.trackShell}>
              <div className={styles.track} style={{ '--fill': `${index * 50}%` } as CSSProperties}>
                <div className={styles.stops} aria-hidden="true">
                  <i />
                  <i />
                  <i />
                </div>
                <input
                  ref={range}
                  type="range"
                  min={0}
                  max={2}
                  step={1}
                  value={index}
                  aria-label={t('effortChoice')}
                  aria-valuetext={t(labels[index])}
                  onPointerDown={(event) => {
                    if (!event.isPrimary || event.button !== 0) {
                      return
                    }
                    event.preventDefault()
                    event.currentTarget.setPointerCapture(event.pointerId)
                    chooseAt(event.clientX, event.currentTarget)
                  }}
                  onPointerMove={(event) => {
                    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                      chooseAt(event.clientX, event.currentTarget)
                    }
                  }}
                  onChange={(event) => setReasoningLevel(levels[event.target.valueAsNumber])}
                />
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
