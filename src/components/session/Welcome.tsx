import { useIsMobile } from '../../app/viewport.js'
import { ChatInput } from '../chatInput/ChatInput.js'
import { MobileHeader } from './MobileHeader.js'
import styles from './Welcome.module.css'

export const Welcome = () => {
  const isMobile = useIsMobile()
  return (
    <div className={styles.container}>
      {isMobile ? <MobileHeader /> : null}
      <div className={styles.composer}>
        <ChatInput sessionId={null} />
      </div>
    </div>
  )
}
