import { useIsMobile } from '../../app/viewport.js'
import { useTranslate } from '../../i18n/index.js'
import { setDraftText } from '../../services/chat/drafts.js'
import { setSearch, setThinking, useSettings } from '../../services/settings.js'
import { ChatInput } from '../chatInput/ChatInput.js'
import {
  IconEditOutline16,
  IconGlobeLanguageOutline14,
  IconLinkOutline16,
  IconRightUpOutline14,
  IconThinkOutline16,
} from '../base/icons.js'
import { openSettings } from '../settings/settingsDialogState.js'
import { MobileHeader } from './MobileHeader.js'
import styles from './Welcome.module.css'

export const Welcome = () => {
  const t = useTranslate()
  const isMobile = useIsMobile()
  const apiKey = useSettings((state) => state.apiKey)
  const choose = (text: string, search: boolean, thinking: boolean) => {
    setDraftText(null, text)
    setSearch(search)
    setThinking(thinking)
    document.querySelector<HTMLTextAreaElement>('textarea')?.focus({ preventScroll: true })
  }
  return (
    <div className={styles.container}>
      {isMobile ? <MobileHeader /> : null}
      <div className={styles.intro}>
        <div className={styles.hero}>
          <div className={styles.avatar} aria-hidden="true">
            <IconThinkOutline16 />
          </div>
          <h1 className={styles.greeting}>{t('homeTitle')}</h1>
          <p className={styles.subtitle}>{t('homeSubtitle')}</p>
        </div>
        <div className={styles.suggestions} aria-label={t('starterPrompts')}>
          <button onClick={() => choose(t('starterWritePrompt'), false, false)}>
            <span className={styles.suggestionIcon}>
              <IconEditOutline16 />
            </span>
            <span>
              <strong>{t('starterWrite')}</strong>
              <small>{t('starterWriteDetail')}</small>
            </span>
            <IconRightUpOutline14 />
          </button>
          <button onClick={() => choose(t('starterSearchPrompt'), true, true)}>
            <span className={styles.suggestionIcon}>
              <IconGlobeLanguageOutline14 />
            </span>
            <span>
              <strong>{t('starterSearch')}</strong>
              <small>{t('starterSearchDetail')}</small>
            </span>
            <IconRightUpOutline14 />
          </button>
          <button onClick={() => choose(t('starterLinkPrompt'), false, false)}>
            <span className={styles.suggestionIcon}>
              <IconLinkOutline16 />
            </span>
            <span>
              <strong>{t('starterLink')}</strong>
              <small>{t('starterLinkDetail')}</small>
            </span>
            <IconRightUpOutline14 />
          </button>
        </div>
        <p className={styles.localNote}>{t('localHistoryNote')}</p>
      </div>
      <div className={styles.composer}>
        {!apiKey ? (
          <button className={styles.connect} onClick={() => openSettings('connection')}>
            <span>{t('connectHint')}</span>
            <strong>
              {t('connectAction')} <IconRightUpOutline14 />
            </strong>
          </button>
        ) : null}
        <ChatInput sessionId={null} />
        <div className={styles.caveat}>{t('contentCaveat')}</div>
      </div>
    </div>
  )
}
