import { create } from 'zustand'
import { parseDocument } from 'yaml'
import { createId } from '../utils/id.js'

export type TextSkill = { id: string; name: string; description: string; body: string }
const prefix = 'chat-demo:text-skill:'
export const defaultSkill: TextSkill = {
  id: 'meeting-notes',
  name: '会议纪要',
  description: '从讨论记录中提取共识、行动和待确认事项。',
  body: '根据提供的会议原文整理纪要。概括结论，区分已确认与待确认事项。逐项列出负责人、交付物和日期，原文未明确的字段标注“待确认”。给重要结论附上对应原文。',
}

function loadSkills(): TextSkill[] {
  const skills = [defaultSkill]
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key?.startsWith(prefix)) {
        continue
      }
      try {
        const item = JSON.parse(localStorage.getItem(key) ?? 'null')
        if (
          item?.id === key.slice(prefix.length) &&
          ['name', 'description', 'body'].every((k) => typeof item[k] === 'string')
        ) {
          skills.push(item)
        }
      } catch {
        /* Skip an unreadable entry without hiding other skills. */
      }
    }
  } catch {
    /* The built-in skill also works in memory. */
  }
  return skills
}

export const useSkills = create<{ items: TextSkill[]; open: boolean }>(() => ({
  items: loadSkills(),
  open: false,
}))
export const openExtensions = () => useSkills.setState({ open: true })
const refresh = () => useSkills.setState({ items: loadSkills() })
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (!event.key || event.key.startsWith(prefix)) {
      refresh()
    }
  })
}

export function readTextSkill(source: string): TextSkill {
  const parts = /^---[ \t]*\n([\s\S]*?)\n---[ \t]*\n([\s\S]+)$/.exec(
    source.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n')
  )
  if (!parts || source.length > 65536) {
    throw Error('skillFormat')
  }
  const doc = parseDocument(parts[1], { schema: 'core' })
  if (doc.errors.length) {
    throw Error('skillFormat')
  }
  const data = doc.toJS({ maxAliasCount: 0 })
  const body = parts[2].trim()
  if (
    !data ||
    typeof data.name !== 'string' ||
    !data.name.trim() ||
    typeof data.description !== 'string' ||
    !data.description.trim() ||
    !body
  ) {
    throw Error('skillFormat')
  }
  if (
    data['allowed-tools'] ||
    data.compatibility ||
    /(?:scripts|references|assets)[/\\]|\]\(\.\.?\//i.test(body)
  ) {
    throw Error('skillDependencies')
  }
  return { id: createId(), name: data.name.trim(), description: data.description.trim(), body }
}

export function installSkill(item: TextSkill) {
  if (loadSkills().some((s) => s.name === item.name)) {
    throw Error('skillDuplicate')
  }
  localStorage.setItem(prefix + item.id, JSON.stringify(item))
  refresh()
}

export function removeSkill(item: TextSkill) {
  if (item.id === defaultSkill.id) {
    return
  }
  localStorage.removeItem(prefix + item.id)
  refresh()
}
