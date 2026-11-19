import { useRef, useState } from 'react'
import { ConnectionSettings,isNotionReturn } from './Connections.js'
import { useTranslate, isTranslationKey } from '../../i18n/index.js'
import { useChatStore } from '../../services/chat/store.js'
import {
  availableSkill,
  isBuiltInSkill,
  enableSkill,
  installSkill,
  readTextSkill,
  removeSkill,
  deleteRegistration,
  saveRegistration,
  useSkills,
  type TextSkill,
  type Registration,
} from '../../services/skills.js'
import { useDrafts, setDraftSkill } from '../../services/chat/drafts.js'
import { createId } from '../../utils/id.js'
import { Button } from '../base/Button.js'
import { Modal } from '../base/Modal.js'

export function ExtensionsDialog() {
  const t = useTranslate()
  const library = useSkills()
  const id = useChatStore((s) => s.activeId)
  const ref = useDrafts(s=>s.drafts.get(id)?.skillRef)
  if (!library.open) {
    return null
  }
  const close = () => useSkills.setState({ open: false })
  const choose = (value: string) => {
    setDraftSkill(id, value || undefined)
    close()
  }
  const current = availableSkill(ref)
  return (
    <Modal title={t('messageSkill')} closable onClose={close} mainClassName="library-scroll">
      <div className="extensions">
        <button className="library-row" onClick={() => choose('')} aria-pressed={!current}>
          {t('autoSkill')}
          <span>{current ? '' : '✓'}</span>
        </button>
        {library.items
          .filter((item) => library.choices[item.id])
          .map((item) => (
            <button
              key={item.id}
              className="library-row"
              aria-pressed={current?.id === item.id}
              onClick={() => choose(library.choices[item.id])}
            >
              <span>
                {item.name}
                <small>{item.description}</small>
              </span>
              <span>{current?.id === item.id ? '✓' : ''}</span>
            </button>
          ))}
      </div>
    </Modal>
  )
}

type Detail =
  | { kind: 'skill'; item: TextSkill; importing?: boolean }
  | { kind: 'entry'; item: Registration; fresh?: boolean }
export function ExtensionLibrary() {
  const t = useTranslate()
  const library = useSkills()
  const [tab, setTab] = useState<'plugin' | 'mcp' | 'skill'>(isNotionReturn?'mcp':'skill')
  const [detail, setDetail] = useState<Detail | null>(null)
  const [error, setError] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(false)
  const file = useRef<HTMLInputElement>(null)
  const origin = useRef<HTMLElement | null>(null)
  const host = useRef<HTMLDivElement>(null)
  const scroll = useRef(0)
  const back = () => {
    setDetail(null)
    setError('')
    setConfirmDelete(false)
    requestAnimationFrame(() => {
      if (host.current?.parentElement) {
        host.current.parentElement.scrollTop = scroll.current
      }
      if (origin.current?.isConnected) {
        origin.current.focus({ preventScroll: true })
      }
    })
  }
  const show = (next: Detail) => {
    scroll.current = host.current?.parentElement?.scrollTop ?? 0
    origin.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    setError('')
    setConfirmDelete(false)
    setDetail(next)
    requestAnimationFrame(() => host.current?.querySelector<HTMLElement>('.library-back')?.focus())
  }
  const handleError = (e: unknown) => {
    const code = e instanceof Error ? e.message : ''
    setError(t(isTranslationKey(code) ? code : 'skillStorageError'))
  }
  const act = (action: () => void) => {
    try {
      action()
      setError('')
    } catch (e) {
      handleError(e)
    }
  }
  const entries = library.registrations.filter((e) => e.kind === tab)
  const item = detail?.kind === 'skill' ? detail.item : undefined
  const entry = detail?.kind === 'entry' ? detail.item : undefined
  const ref = item ? library.choices[item.id] : ''
  return (
    <div className="extensions" ref={host}>
      <div className="extension-list" hidden={!!detail}>
        <div className="library-tabs" aria-label={t('extensionLibrary')}>
          {(['plugin', 'mcp', 'skill'] as const).map((kind) => (
            <button
              key={kind}
              aria-pressed={tab === kind}
              onClick={() => {
                setTab(kind)
                setError('')
              }}
            >
              {t(kind)}
            </button>
          ))}
        </div>
        {tab === 'skill' ? (
          <>
            {library.items.map((s) => (
              <button
                className="library-row"
                key={s.id}
                onClick={() => show({ kind: 'skill', item: s })}
              >
                <span>
                  {s.name}
                  <small>{s.description}</small>
                </span>
                <small>
                  {t(
                    !library.choices[s.id]
                      ? 'disabledState'
                      : 'enabledState'
                  )}{' '}
                  ›
                </small>
              </button>
            ))}
            <input
              hidden
              type="file"
              ref={file}
              accept=".md,text/markdown"
              onChange={async (e) => {
                const f = e.target.files?.[0]
                e.target.value = ''
                if (!f) {
                  return
                }
                try {
                  if (!/\.md$/i.test(f.name) || f.size > 65536) {
                    throw Error('skillFormat')
                  }
                  show({ kind: 'skill', item: readTextSkill(await f.text()), importing: true })
                } catch (err) {
                  handleError(
                    err instanceof Error && err.message === 'skillDependencies'
                      ? err
                      : Error('skillFormat')
                  )
                }
              }}
            />
            <Button variant="outlined" onClick={() => file.current?.click()}>
              {t('importSkill')}
            </Button>
          </>
        ) : (
          <>
            {tab==='mcp' && <ConnectionSettings/>}
            {entries.map((e) => (
              <button
                key={e.id}
                className="library-row"
                onClick={() => show({ kind: 'entry', item: { ...e } })}
              >
                <span>
                  {e.name}
                  <small>{e.description}</small>
                </span>
                <small>{t('registered')} ›</small>
              </button>
            ))}
            {!entries.length && tab==='plugin' && <p>{t('emptyPlugin')}</p>}
            <Button
              variant="outlined"
              onClick={() =>
                show({
                  kind: 'entry',
                  fresh: true,
                  item: { id: createId(), kind: tab, name: '', description: '', config: '' },
                })
              }
            >
              {t(tab === 'mcp' ? 'addMcp' : 'addPlugin')}
            </Button>
          </>
        )}
      </div>
      {detail && (
        <button className="library-back" onClick={back}>
          ‹ {t(tab)}
        </button>
      )}
      {item && detail?.kind === 'skill' && (
        <>
          <h3>{item.name}</h3>
          <p>{item.description}</p>
          {detail.importing ? (
            <>
              <pre>{item.body}</pre>
              <Button
                onClick={() =>
                  act(() => {
                    installSkill(item)
                    setDetail({ kind: 'skill', item })
                  })
                }
              >
                {t('saveSkill')}
              </Button>
            </>
          ) : (
            <>
              <label className="library-row">
                {t('globalEnable')}
                <input
                  type="checkbox"
                  role="switch"
                  checked={!!ref}
                  onChange={(e) => act(() => enableSkill(item, e.target.checked))}
                />
              </label>
              <small>{t('autoSkillHint')}</small>
              <details>
                <summary>{t('skillInstructions')}</summary>
                <pre>{item.body}</pre>
              </details>
            </>
          )}
        </>
      )}
      {entry && detail?.kind === 'entry' && (
        <form
          className="extension-form"
          onSubmit={(e) => {
            e.preventDefault()
            if (!entry.name.trim()) {
              setError(t('entryName'))
              return
            }
            act(() => {
              saveRegistration({ ...entry, name: entry.name.trim() })
              back()
            })
          }}
        >
          <small>{t('registeredNote')}</small>
          {(['name', 'description', 'config'] as const).map((field) => (
            <label key={field}>
              {t(
                field === 'name'
                  ? 'entryName'
                  : field === 'config'
                    ? 'entryConfig'
                    : 'entryDescription'
              )}
              {field === 'config' ? (
                <textarea
                  rows={4}
                  value={entry.config}
                  onChange={(e) =>
                    setDetail({ ...detail, item: { ...entry, config: e.target.value } })
                  }
                />
              ) : (
                <input
                  required={field === 'name'}
                  value={entry[field]}
                  onChange={(e) =>
                    setDetail({ ...detail, item: { ...entry, [field]: e.target.value } })
                  }
                />
              )}
            </label>
          ))}
          <Button type="submit">{t('saveEntry')}</Button>
        </form>
      )}
      {detail &&
        ((detail.kind === 'entry' && !detail.fresh) ||
          (detail.kind === 'skill' && !detail.importing && !!item && !isBuiltInSkill(item.id))) && (
          <Button
            variant="dangerOutlined"
            onClick={() => {
              if (!confirmDelete) {
                setConfirmDelete(true)
                return
              }
              act(() => {
                if (entry) {
                  deleteRegistration(entry.id)
                } else if (item) {
                  removeSkill(item)
                }
                back()
              })
            }}
          >
            {t(confirmDelete ? 'confirmRemove' : 'delete')}
          </Button>
        )}
      {error && <p role="alert">{error}</p>}
    </div>
  )
}
