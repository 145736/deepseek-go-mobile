import { Button } from '../base/Button.js'
import { Modal } from '../base/Modal.js'
import { useEffect, useId, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslate } from '../../i18n/index.js'
import {
  setModel,
  setReasoningLevel,
  useSettings,
  useFlashPrompt,
} from '../../services/settings.js'
import { IconCheckOutline16, IconPaperclipOutline16 } from '../base/icons.js'
import { useAnchoredPosition, useDismiss } from '../base/anchored.js'
import styles from './ModelControls.module.css'

const levels = ['off', 'low', 'high', 'max'] as const
const labels = ['effortOff', 'effortLow', 'effortHigh', 'effortMax'] as const
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
  const level = useSettings((state) => (state.thinking ? state.effort : 'off'))
  const index = levels.indexOf(level)
  const [open, setOpen] = useState(false)
  const id = useId()
  const { anchorRef, floatingRef, position } = useAnchoredPosition<
    HTMLButtonElement,
    HTMLDivElement
  >(open, { side: 'top', align: 'start', offset: 6, maxHeight: 320, minSpace: 190 })
  useDismiss(open, [anchorRef, floatingRef], () => setOpen(false))
  useEffect(() => {
    if (open) {
      floatingRef.current?.focus({ preventScroll: true })
    }
  }, [open, floatingRef])
  useEffect(() => {
    if (disabled) {
      setOpen(false)
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
        onClick={() => setOpen((value) => !value)}
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
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                setOpen(false)
                anchorRef.current?.focus({ preventScroll: true })
              }
            }}
            onBlur={(event) => {
              if (
                event.relatedTarget &&
                event.relatedTarget !== anchorRef.current &&
                !event.currentTarget.contains(event.relatedTarget)
              ) {
                setOpen(false)
              }
            }}
          >
            <div className={styles.modelRow} role="group" aria-label={t('modelChoice')}>
              <span>{t('modelChoice')}</span>
              <div className={styles.segment}>
                {models.map(([value, label]) => (
                  <button
                    type="button"
                    key={value}
                    aria-pressed={model === value}
                    onClick={() => setModel(value)}
                  >
                    {label}
                    {model === value && <IconCheckOutline16 />}
                  </button>
                ))}
              </div>
            </div>
            <div className={styles.levelHeading}>
              <label htmlFor={id + '-effort'}>{t('effortChoice')}</label>
              <strong>{t(labels[index])}</strong>
            </div>
            <div className={styles.scale}>
              <input
                id={id + '-effort'}
                type="range"
                min={0}
                max={3}
                step={1}
                value={index}
                aria-valuetext={t(labels[index])}
                onChange={(event) => setReasoningLevel(levels[event.target.valueAsNumber])}
              />
              <div className={styles.ticks}>
                {levels.map((value, i) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={i === index}
                    onClick={() => setReasoningLevel(value)}
                  >
                    {t(labels[i])}
                  </button>
                ))}
              </div>
            </div>
            <button
              className={styles.upload}
              type="button"
              onClick={() => {
                setOpen(false)
                onUpload()
              }}
            >
              <IconPaperclipOutline16 />
              {t('addMedia')}
            </button>
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
