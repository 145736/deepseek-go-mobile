import { create } from 'zustand'
import { parseDocument } from 'yaml'
import { officialDocumentSkill } from './builtins/officialDocument.js'
import { createId } from '../utils/id.js'

export type TextSkill = { id: string; name: string; description: string; body: string }
const prefix = 'chat-demo:text-skill:'
export const defaultSkill: TextSkill = {
  id: 'meeting-notes',
  name: '会议纪要',
  description: '从讨论记录中提取共识、行动和待确认事项。',
  body: '根据提供的会议原文整理纪要。概括结论，区分已确认与待确认事项。逐项列出负责人、交付物和日期，原文未明确的字段标注“待确认”。给重要结论附上对应原文。',
}

const builtInSkills = [defaultSkill, officialDocumentSkill]
export const isBuiltInSkill = (id: string) => builtInSkills.some((item) => item.id === id)

function loadSkills(): TextSkill[] {
  const skills = [...builtInSkills]
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

export type Registration = {
  id: string
  kind: 'plugin' | 'mcp'
  name: string
  description: string
  config: string
}
const entryPrefix = 'chat-demo:registration:'
const switchPrefix = 'chat-demo:skill-switch:'

function loadLibrary() {
  const items = loadSkills()
  const registrations: Registration[] = []
  const choices: Record<string, string> = Object.create(null)
  for (const item of items) {
    choices[item.id] = item.id
  }
  try {
    for (const item of items) {
      choices[item.id] = localStorage.getItem(switchPrefix + item.id) ?? item.id
    }
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (!key?.startsWith(entryPrefix)) {
        continue
      }
      try {
        const entry = JSON.parse(localStorage.getItem(key) ?? 'null')
        if (
          entry?.id === key.slice(entryPrefix.length) &&
          ['plugin', 'mcp'].includes(entry.kind) &&
          ['name', 'description', 'config'].every((field) => typeof entry[field] === 'string')
        ) {
          registrations.push(entry)
        }
      } catch {
        /* Keep other registrations available. */
      }
    }
  } catch {
    /* Built-in skills work while browser storage is unavailable. */
  }
  return { items, choices, registrations }
}
export const useSkills = create(() => ({ ...loadLibrary(), open: false }))
export const openExtensions = () => useSkills.setState({ open: true })
const refresh = () => useSkills.setState(loadLibrary())
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (event) => {
    if (
      !event.key ||
      event.key.startsWith(prefix) ||
      event.key.startsWith(entryPrefix) ||
      event.key.startsWith(switchPrefix)
    ) {
      refresh()
    }
  })
}

export function availableSkill(ref?: string) {
  if (!ref) {
    return undefined
  }
  const { items, choices } = useSkills.getState()
  return items.find((item) => choices[item.id] === ref)
}
export function enableSkill(item: TextSkill, enabled: boolean) {
  // A fresh reference prevents previously disabled selections from reviving.
  localStorage.setItem(switchPrefix + item.id, enabled ? item.id + '@' + createId() : '')
  refresh()
}
export function saveRegistration(entry: Registration) {
  localStorage.setItem(entryPrefix + entry.id, JSON.stringify(entry))
  refresh()
}
export function deleteRegistration(id: string) {
  localStorage.removeItem(entryPrefix + id)
  refresh()
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
  if (isBuiltInSkill(item.id)) {
    return
  }
  localStorage.removeItem(prefix + item.id)
  refresh()
}
