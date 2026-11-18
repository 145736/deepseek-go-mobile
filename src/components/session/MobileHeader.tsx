import { IconMenuOutline20 } from '../base/icons.js'
import { useTranslate } from '../../i18n/index.js'
import { IconButton } from '../base/IconButton.js'
import { openMobileSider } from '../sider/mobileSiderState.js'
import styles from './MobileHeader.module.css'

export const MobileHeader = () => {
  const t = useTranslate()
  return (
    <div className={styles.menu}>
      <IconButton
        size="xl"
        tone="primary"
        icon={<IconMenuOutline20 />}
        aria-label={t('expandSiderbarButton')}
        onClick={openMobileSider}
      />
    </div>
  )
}
