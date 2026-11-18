import { useEffect, useRef, useState } from 'react'
import { isTranslationKey, useTranslate } from '../../i18n/index.js'
import { setConversationSkill, useChatStore } from '../../services/chat/store.js'
import {
  defaultSkill,
  installSkill,
  readTextSkill,
  removeSkill,
  useSkills,
  type TextSkill,
} from '../../services/skills.js'
import { requireFlash, setSearch, useSettings } from '../../services/settings.js'
import { Button } from '../base/Button.js'
import { Modal } from '../base/Modal.js'

export function ExtensionsDialog() {
  return useSkills((s) => s.open) ? <Library /> : null
}

function Library() {
  const t = useTranslate()
  const items = useSkills((s) => s.items)
  const sessionId = useChatStore((s) => s.activeId)
  const selected = useChatStore((s) =>
    s.activeId ? s.sessionCache[s.activeId]?.skillId : s.newChatSkillId
  )
  const [tab, setTab] = useState<'skills' | 'tools'>('skills')
  const [item, setItem] = useState<TextSkill | null>(null)
  const [error, setError] = useState('')
  const [importing, setImporting] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)
  const model = useSettings((s) => s.model)
  const search = useSettings((s) => s.search && s.model === 'deepseek-flash')
  const close = () => useSkills.setState({ open: false })
  useEffect(() => {
    setItem(null)
    setError('')
    setImporting(false)
  }, [sessionId])
  const choose = (id?: string) => {
    setConversationSkill(sessionId, id)
    close()
  }
  const showError = (e: unknown) => {
    const code = e instanceof Error ? e.message : ''
    setError(t(isTranslationKey(code) ? code : 'skillStorageError'))
  }

  return (
    <Modal
      mainClassName="library-scroll"
      title={item?.name ?? t('extensions')}
      closable
      onClose={close}
    >
      <div className="extensions">
        {item ? (
          <>
            <button
              type="button"
              className="library-back"
              onClick={() => {
                setItem(null)
                setError('')
              }}
            >
              ‹ {t('mySkills')}
            </button>
            <p>{item.description}</p>
            <pre>{item.body}</pre>
            {importing ? (
              <Button
                onClick={() => {
                  try {
                    installSkill(item)
                    setImporting(false)
                    setError('')
                  } catch (e) {
                    showError(e)
                  }
                }}
              >
                {t('saveSkill')}
              </Button>
            ) : (
              <>
                <Button onClick={() => choose(selected === item.id ? undefined : item.id)}>
                  {t(selected === item.id ? 'unselectSkill' : 'selectSkill')}
                </Button>
                {item.id !== defaultSkill.id && (
                  <Button
                    variant="outlined"
                    onClick={() => {
                      try {
                        removeSkill(item)
                        if (selected === item.id) {
                          setConversationSkill(sessionId, undefined)
                        }
                        setItem(null)
                        setError('')
                      } catch (e) {
                        showError(e)
                      }
                    }}
                  >
                    {t('delete')}
                  </Button>
                )}
              </>
            )}
          </>
        ) : (
          <>
            <div className="library-tabs">
              <button
                type="button"
                aria-pressed={tab === 'skills'}
                onClick={() => setTab('skills')}
              >
                {t('mySkills')}
              </button>
              <button type="button" aria-pressed={tab === 'tools'} onClick={() => setTab('tools')}>
                {t('officialTools')}
              </button>
            </div>
            {tab === 'skills' ? (
              <>
                {items.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    className="library-row"
                    onClick={() => {
                      setItem(s)
                      setImporting(false)
                      setError('')
                    }}
                  >
                    <span>
                      {s.name}
                      <small>{s.description}</small>
                    </span>
                    <span>{selected === s.id ? '✓' : '›'}</span>
                  </button>
                ))}
                <input
                  type="file"
                  accept=".md,text/markdown"
                  hidden
                  ref={fileRef}
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    e.target.value = ''
                    if (!file) {
                      return
                    }
                    try {
                      if (!/\.md$/i.test(file.name) || file.size > 65536) {
                        throw Error('skillFormat')
                      }
                      let parsed: TextSkill
                      try {
                        parsed = readTextSkill(await file.text())
                      } catch (err) {
                        throw err instanceof Error && err.message === 'skillDependencies'
                          ? err
                          : Error('skillFormat')
                      }
                      setItem(parsed)
                      setImporting(true)
                      setError('')
                    } catch (err) {
                      showError(err)
                    }
                  }}
                />
                <Button variant="outlined" onClick={() => fileRef.current?.click()}>
                  {t('importSkill')}
                </Button>
                <small>{t('skillSupport')}</small>
              </>
            ) : (
              <>
                <button
                  className="library-row"
                  type="button"
                  aria-pressed={search}
                  onClick={() => {
                    if (requireFlash(() => setSearch(true))) {
                      setSearch(!search)
                    }
                  }}
                >
                  <span>{t('search')}</span>
                  <strong>
                    {model === 'deepseek-flash' ? t(search ? 'searchOn' : 'searchOff') : 'Flash'}
                  </strong>
                </button>
                <p>{t('officialNote')}</p>
              </>
            )}
          </>
        )}
        {error && <p role="alert">{error}</p>}
      </div>
    </Modal>
  )
}
