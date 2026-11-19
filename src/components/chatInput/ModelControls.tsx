import { providers, useConnections, type Provider } from '../../services/connections/config.js'
import { openSettings, openConnectorLibrary } from '../settings/settingsDialogState.js'
import { useSkills } from '../../services/skills.js'
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
  IconPlugOutline16,
  IconSkillsOutline16,
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
  onConnector,
  skillRef,
  onSkill,
}: {
  disabled: boolean
  plusClass: string
  onConnector: (provider: Provider) => void
  skillRef?: string
  onSkill: (ref?: string) => void
  onUpload: () => void
}) {
  const t = useTranslate()
  const model = useSettings((state) => state.model)
  const connections = useConnections()
  const library = useSkills()
  const [page, setPage] = useState<'actions' | 'models' | 'skills' | 'connectors' | null>(null)
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
    maxHeight: 260,
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
                <button type="button" onClick={() => setPage('skills')}>
                  <IconSkillsOutline16 />
                  {t('skill')}
                  <IconChevronRightOutline14 />
                </button>
                <button type="button" onClick={() => setPage('connectors')}>
                  <IconPlugOutline16 />
                  {t('connectors')}
                  <IconChevronRightOutline14 />
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
            ) : page === 'connectors' || page === 'skills' ? (
              <>
                <button type="button" data-back aria-label={t('menuBack')} onClick={() => setPage('actions')}>
                  <IconChevronRightOutline14 />{t(page === 'skills' ? 'skill' : 'connectors')}
                </button>
                {page === 'skills' ? (
                  <>
                    <button type="button" aria-pressed={!skillRef} onClick={() => { close(); onSkill() }}>
                      {t('autoSkill')}
                      {!skillRef && <span className={styles.check}><IconCheckOutline16 /></span>}
                    </button>
                    {library.items.filter(item => library.choices[item.id]).map(item => {
                      const ref = library.choices[item.id]
                      return (
                        <button type="button" key={item.id} title={item.description}
                          aria-pressed={skillRef === ref} onClick={() => { close(); onSkill(ref) }}>
                          {item.name}
                          {skillRef === ref && <span className={styles.check}><IconCheckOutline16 /></span>}
                        </button>
                      )
                    })}
                  </>
                ) : providers.map((provider) => (
                  <button key={provider} type="button" disabled={!connections[provider].enabled}
                    onClick={() => { close(); onConnector(provider) }}>
                    {provider}
                    {!connections[provider].enabled && <small>{t('connectorInactive')}</small>}
                  </button>
                ))}
                <button type="button" onClick={() => {
                  close(true)
                  if (page === 'skills') {
                    openSettings('extensions')
                  } else {
                    openConnectorLibrary()
                  }
                }}>
                  {t(page === 'skills' ? 'manageSkills' : 'manageConnectors')}<IconChevronRightOutline14 />
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
