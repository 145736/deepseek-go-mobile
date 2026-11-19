import { useEffect, useId, useState, type KeyboardEvent, type RefObject } from 'react'
import { useTranslate } from '../../i18n/index.js'
import { setDraftSkill, setDraftText } from '../../services/chat/drafts.js'
import { useSkills } from '../../services/skills.js'
import {providers,useConnections} from '../../services/connections/config.js'

export function useSkillMention(
  id: string | null,
  text: string,
  input: RefObject<HTMLTextAreaElement>
) {
  const library = useSkills()
  const connections = useConnections()
  const t = useTranslate()
  const listId = useId()
  const [cursor, setCursor] = useState<number | null>(null)
  const [index, setIndex] = useState(0)
  const query =
    cursor === null
      ? undefined
      : /(?:^|[^\w.+@＠-])[@＠]([^\s@＠]*)$/u.exec(text.slice(0, cursor))?.[1]
  const items =
    query === undefined
      ? []
      : [...library.items.filter(
          (s) =>
            library.choices[s.id] &&
            (s.name + ' ' + s.description).toLocaleLowerCase().includes(query.toLocaleLowerCase())
        ), ...providers.filter(p=>connections[p].enabled && p.toLowerCase().includes(query.toLowerCase()))
          .map(p=>({id:'connection:'+p,name:p,description:p==='regs'?'查询法规与原文':p==='Notion'?'读取页面或保存到 Notion':'读取仓库或创建 Issue'}))]
  const active = Math.max(0, Math.min(index, items.length - 1))
  const open = query !== undefined
  const update = (el: HTMLTextAreaElement) => {
    setCursor(el.selectionStart === el.selectionEnd ? el.selectionStart : null)
    setIndex(0)
  }
  const close = () => setCursor(null)
  const choose = (n: number) => {
    const item = items[n]
    if (!item || cursor === null || query === undefined) {
      return
    }
    const start = cursor - query.length - 1
    if(item.id.startsWith('connection:')){
      const prefix = text.slice(0,start)+'@'+item.name+' '
      setDraftText(id,prefix+text.slice(cursor))
      close()
      input.current?.focus({preventScroll:true})
      requestAnimationFrame(()=>input.current?.setSelectionRange(prefix.length,prefix.length))
      return
    }
    const next = text.slice(0, start) + text.slice(cursor)
    setDraftText(id, next)
    setDraftSkill(id, library.choices[item.id])
    close()
    input.current?.focus({ preventScroll: true })
    requestAnimationFrame(() => input.current?.setSelectionRange(start, start))
  }
  const keyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (!open || e.nativeEvent.isComposing || e.keyCode === 229) {
      return false
    }
    if (e.key === 'Escape') {
      close()
    } else if (e.key === 'ArrowDown' && items.length) {
      setIndex((active + 1) % items.length)
    } else if (e.key === 'ArrowUp' && items.length) {
      setIndex((active + items.length - 1) % items.length)
    } else if (e.key === 'Enter' && !e.shiftKey && items.length) {
      choose(active)
    } else {
      return false
    }
    e.preventDefault()
    return true
  }
  useEffect(() => {
    if (open) {
      document.getElementById(listId + '-' + active)?.scrollIntoView({ block: 'nearest' })
    }
  }, [active, listId, open])
  const menu = open ? (
    <div className="skill-mentions" onMouseDown={(e) => e.preventDefault()}>
      <div id={listId} role="listbox" aria-label={t('messageSkill')}>
        {items.map((s, i) => (
          <button
            key={s.id}
            type="button"
            role="option"
            tabIndex={-1}
            id={listId + '-' + i}
            aria-selected={i === active}
            onClick={() => choose(i)}
          >
            <strong>{s.name}</strong>
            <small>{s.description}</small>
          </button>
        ))}
      </div>
      {!items.length && <p role="status">{t('noMatchSkill')}</p>}
    </div>
  ) : null
  return {
    menu,
    update,
    close,
    keyDown,
    listId: open ? listId : undefined,
    activeId: open && items.length ? listId + '-' + active : undefined,
  }
}
