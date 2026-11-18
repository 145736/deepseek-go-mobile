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
  const model = useSettings((state) => state.model)
  const [phase, setPhase] = useState<'closed' | 'open' | 'closing'>('closed')
  const open = phase === 'open'
  const [dragPosition, setDragPosition] = useState<number | null>(null)
  const position = dragPosition ?? index / (levels.length - 1)
  const preview = Math.round(position * (levels.length - 1))
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
    setPhase('open')
  }
  function dismiss() {
    setDragPosition(null)
    setPhase('closing')
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
  function positionAt(clientX: number, input: HTMLInputElement) {
    const rect = input.getBoundingClientRect()
    const radius = parseFloat(getComputedStyle(input).getPropertyValue('--thumb-size')) / 2
    const fraction = (clientX - rect.left - radius) / (rect.width - 2 * radius)
    return Math.max(0, Math.min(1, fraction))
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
      {phase !== 'closed' && (
        <>
          <div
            className={styles.dismiss}
            aria-hidden="true"
            onMouseDown={(event) => event.preventDefault()}
            onPointerDown={(event) => {
              event.preventDefault()
              if (event.isPrimary && event.button === 0) {
                event.currentTarget.setPointerCapture(event.pointerId)
              }
            }}
            onPointerUp={(event) => {
              if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                dismiss()
              }
            }}
          />
          <div
            className={styles.effortSheet}
            data-closing={phase === 'closing'}
            aria-hidden={!open}
            onAnimationEnd={(event) => {
              if (event.target === event.currentTarget && phase === 'closing') {
                setPhase('closed')
              }
            }}
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
                setDragPosition(null)
                setPhase('closing')
              }
            }}
          >
            <div className={styles.heading}>
              <svg
                className={styles.bolt}
                viewBox="0 0 20 20"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.45"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <path d="M11.5 2.5 4.4 11h4.7l-.8 6.5 7.3-9H11z" />
              </svg>
              <span className={styles.level} key={preview}>
                {t(labels[preview])}
              </span>
              <span className={styles.modelName}>
                DeepSeek {model === 'deepseek-flash' ? 'Flash' : 'Pro'}
              </span>
              <button
                type="button"
                className={styles.close}
                aria-label={t('close')}
                onClick={dismiss}
              >
                <IconCloseFill14 />
              </button>
            </div>
            <div
              className={styles.trackShell}
              data-dragging={dragPosition !== null}
              style={{ '--position': `${position * 100}%` } as CSSProperties}
            >
              <div className={styles.track} aria-hidden="true">
                <div className={styles.travel}>
                  <div className={styles.fill} />
                </div>
                <div className={styles.stops}>
                  {levels.map((level, i) => (
                    <i key={level} data-filled={i / (levels.length - 1) <= position} />
                  ))}
                </div>
              </div>
              <div className={styles.travel} aria-hidden="true">
                <div className={styles.carriage}>
                  <span className={styles.thumb} />
                </div>
              </div>
              <input
                ref={range}
                type="range"
                min={0}
                max={2}
                step={1}
                value={preview}
                aria-label={t('effortChoice')}
                aria-valuetext={t(labels[preview])}
                onPointerDown={(event) => {
                  if (!event.isPrimary || event.button !== 0) {
                    return
                  }
                  event.preventDefault()
                  event.currentTarget.setPointerCapture(event.pointerId)
                  setDragPosition(positionAt(event.clientX, event.currentTarget))
                }}
                onPointerMove={(event) => {
                  if (event.currentTarget.hasPointerCapture(event.pointerId)) {
                    setDragPosition(positionAt(event.clientX, event.currentTarget))
                  }
                }}
                onPointerUp={(event) => {
                  if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
                    return
                  }
                  const value = positionAt(event.clientX, event.currentTarget)
                  setReasoningLevel(levels[Math.round(value * (levels.length - 1))])
                  setDragPosition(null)
                }}
                onLostPointerCapture={() => setDragPosition(null)}
                onPointerCancel={() => setDragPosition(null)}
                onChange={(event) => {
                  if (dragPosition === null) {
                    setReasoningLevel(levels[event.target.valueAsNumber])
                  }
                }}
              />
            </div>
          </div>
        </>
      )}
    </>
  )
}
