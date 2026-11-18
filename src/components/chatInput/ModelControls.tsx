import { openExtensions } from '../../services/skills.js'
import { Button } from '../base/Button.js'
import { Modal } from '../base/Modal.js'
import { useEffect, useId, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslate } from '../../i18n/index.js'
import { setModel, useSettings, useFlashPrompt } from '../../services/settings.js'
import {
  IconCheckOutline16,
  IconChevronRightOutline14,
  IconPaperclipOutline16,
  IconThinkOutline16,
} from '../base/icons.js'
import { useAnchoredPosition, useDismiss } from '../base/anchored.js'
import styles from './ModelControls.module.css'

const models = [
  ['deepseek-flash', 'Flash'],
  ['deepseek-v4-pro', 'Pro'],
] as const

export function ModelControls({
  disabled,
  plusClass,
  onUpload,
}: {
  disabled: boolean
  plusClass: string
  onUpload: () => void
}) {
  const t = useTranslate()
  const model = useSettings((state) => state.model)
  const [page, setPage] = useState<'actions' | 'models' | null>(null)
  const open = page !== null
  const keyboard = useRef(false)
  const id = useId()
  const { anchorRef, floatingRef, position } = useAnchoredPosition<
    HTMLButtonElement,
    HTMLDivElement
  >(open, {
    side: 'top',
    align: 'start',
    offset: 6,
    maxHeight: 240,
    minSpace: 108,
    measureKey: page,
  })
  function close(restore = false) {
    setPage(null)
    if (restore && keyboard.current) {
      anchorRef.current?.focus({ preventScroll: true })
    }
  }
  useDismiss(open, [anchorRef, floatingRef], () =>
    close(
      document.activeElement === document.body ||
        Boolean(floatingRef.current?.contains(document.activeElement))
    )
  )
  useEffect(() => {
    if (page && keyboard.current) {
      const panel = floatingRef.current
      const button =
        panel?.querySelector<HTMLButtonElement>('button[aria-pressed="true"]') ??
        panel?.querySelector('button')
      button?.focus({ preventScroll: true })
    }
  }, [page, floatingRef])
  useEffect(() => {
    if (disabled) {
      setPage(null)
    }
  }, [disabled])

  return (
    <>
      <button
        type="button"
        ref={anchorRef}
        className={styles.trigger}
        disabled={disabled}
        aria-label={t('modelControls')}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls={open ? id : undefined}
        onClick={(event) => {
          keyboard.current = event.detail === 0
          setPage(open ? null : 'actions')
        }}
      >
        <span className={plusClass} aria-hidden="true" />
      </button>
      {open &&
        createPortal(
          <div
            id={id}
            role="dialog"
            aria-label={t('modelControls')}
            ref={floatingRef}
            tabIndex={-1}
            className={styles.panel}
            style={{ ...position, visibility: position ? 'visible' : 'hidden' }}
            onMouseDown={(event) => {
              if (document.activeElement instanceof HTMLTextAreaElement) {
                event.preventDefault()
              }
            }}
            onBlur={(event) => {
              if (event.relatedTarget && !event.currentTarget.contains(event.relatedTarget)) {
                close()
              }
            }}
          >
            {page === 'actions' ? (
              <>
                <button
                  type="button"
                  onClick={() => {
                    close(true)
                    onUpload()
                  }}
                >
                  <IconPaperclipOutline16 />
                  {t('addMedia')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    close(true)
                    openExtensions()
                  }}
                >
                  {t('messageSkill')}
                </button>
                <button type="button" onClick={() => setPage('models')}>
                  <IconThinkOutline16 />
                  {t('modelChoice')}
                  <span className={styles.value}>
                    {models.find(([value]) => value === model)?.[1]}
                  </span>
                  <IconChevronRightOutline14 />
                </button>
              </>
            ) : (
              models.map(([value, label]) => (
                <button
                  type="button"
                  key={value}
                  aria-pressed={model === value}
                  onClick={() => {
                    setModel(value)
                    close(true)
                  }}
                >
                  {label}
                  {model === value && (
                    <span className={styles.check}>
                      <IconCheckOutline16 />
                    </span>
                  )}
                </button>
              ))
            )}
          </div>,
          document.body
        )}
    </>
  )
}

export function FlashPrompt() {
  const t = useTranslate()
  const pending = useFlashPrompt((state) => state.pending)
  if (!pending) {
    return null
  }
  const close = () => useFlashPrompt.setState({ pending: null })
  return (
    <Modal
      title={t('switchFlash')}
      onClose={close}
      footer={
        <>
          <Button variant="outlined" onClick={close}>
            {t('cancel')}
          </Button>
          <Button
            onClick={() => {
              close()
              setModel('deepseek-flash')
              pending.resume?.()
            }}
          >
            {t('switchFlash')}
          </Button>
        </>
      }
    >
      <p>{t('switchFlashPrompt')}</p>
    </Modal>
  )
}
