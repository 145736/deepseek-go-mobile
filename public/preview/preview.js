'use strict'
const $ = (id) => document.getElementById(id)
const root = document.documentElement
const draft = $('draft')
const composer = $('composer')
const sheet = $('sheet')
const sampleSkill = {
  name: '会议纪要',
  description: '从讨论记录中提取共识、行动和待确认事项。',
  body: '根据提供的会议原文整理纪要。\n\n1. 用两句话概括会议结论。\n2. 分列已确认事项与待确认事项。\n3. 行动项写明负责人、交付物和日期；原文未明确的字段标注“待确认”。\n4. 给重要结论附上对应原文。',
}
const skills = [sampleSkill]
const threads = new Map()
function makeThread() {
  return { draft: '', messages: [], skill: null, scroll: 0 }
}
threads.set('example', makeThread())
threads.set('new', makeThread())
let threadId = 'example'
const conversation = () => threads.get(threadId)
let model = 'Flash'
let search = false
let thinking = false
let effort = 1
const levels = ['低', '高', '最高']
let dialogPages = []
let restoreDraft = false
let feedbackTimer
const appearance = matchMedia('(prefers-color-scheme: dark)')
let theme = '跟随系统'
function updateTheme() {
  root.dataset.dark = String(theme === '深色' || (theme === '跟随系统' && appearance.matches))
}
appearance.addEventListener('change', updateTheme)
updateTheme()
function syncViewport() {
  const viewport = window.visualViewport
  if (viewport && viewport.scale === 1) {
    root.style.setProperty('--vh', viewport.height + 'px')
    root.style.setProperty('--vtop', viewport.offsetTop + 'px')
  }
}
window.visualViewport?.addEventListener('resize', syncViewport)
window.visualViewport?.addEventListener('scroll', syncViewport)
syncViewport()

function tell(text) {
  $('notice').textContent = text
  clearTimeout(feedbackTimer)
  feedbackTimer = setTimeout(() => {
    $('notice').textContent = ''
  }, 1800)
}
function icon(id) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
  const use = document.createElementNS(svg.namespaceURI, 'use')
  use.setAttribute('href', '#' + id)
  svg.setAttribute('aria-hidden', 'true')
  svg.append(use)
  return svg
}
function el(tag, text, cls) {
  const node = document.createElement(tag)
  if (text !== undefined) node.textContent = text
  if (cls) node.className = cls
  return node
}
function button(text, handle, cls) {
  const b = el('button', text, cls)
  b.type = 'button'
  b.addEventListener('click', handle)
  return b
}
function row(text, symbol, handle, value) {
  const b = button('', handle, 'row')
  b.append(icon(symbol), el('span', text))
  if (value) b.append(el('small', value))
  else b.append(icon('chev'))
  return b
}

function setStyle(value) {
  const viewport = $('scroll')
  const line = viewport.getBoundingClientRect().top + Math.min(140, viewport.clientHeight / 3)
  const anchor = [...$('thread').querySelectorAll('[data-anchor]')].find(
    (n) => n.getBoundingClientRect().bottom > line && n.getClientRects().length
  )
  const before = anchor?.getBoundingClientRect().top
  const atTop = viewport.scrollTop === 0
  root.dataset.style = value
  for (const b of document.querySelectorAll('[data-pick]'))
    b.setAttribute('aria-pressed', String(b.dataset.pick === value))
  updateComposer()
  if (!atTop && anchor) viewport.scrollTop += anchor.getBoundingClientRect().top - before
  const url = new URL(location.href)
  url.searchParams.set('style', value)
  history.replaceState(null, '', url)
}
for (const b of document.querySelectorAll('[data-pick]')) {
  b.addEventListener('click', () => setStyle(b.dataset.pick))
}
document.querySelector('header').addEventListener('pointerdown', (event) => {
  if (document.activeElement === draft && event.target.closest('button')) event.preventDefault()
})
function updateComposer() {
  const expanded =
    document.activeElement === draft ||
    draft.value.length > 0 ||
    !$('dialPanel').hidden ||
    (sheet.open && restoreDraft)
  composer.classList.toggle('expanded', expanded)
  draft.style.height = expanded ? '36px' : '44px'
  if (expanded) draft.style.height = Math.min(116, Math.max(36, draft.scrollHeight)) + 'px'
  $('sendBtn').disabled = !draft.value.trim()
  $('search').setAttribute('aria-pressed', String(search && model === 'Flash'))
  $('reason').setAttribute('aria-pressed', String(thinking))
  $('skillPill').hidden = !conversation().skill
  $('skillPill').textContent = conversation().skill?.name || ''
}
draft.addEventListener('input', () => {
  conversation().draft = draft.value
  updateComposer()
})
draft.addEventListener('focus', updateComposer)
draft.addEventListener('blur', () => requestAnimationFrame(updateComposer))
composer.addEventListener('mousedown', (e) => {
  if (document.activeElement === draft && e.target.closest('button')) e.preventDefault()
})
function renderMessages() {
  const list = $('messages')
  list.replaceChildren()
  for (const msg of conversation().messages) {
    const text = el('p', msg.text, 'user-msg')
    text.dataset.anchor = ''
    const details = el('details', undefined, 'receipt')
    details.append(
      el('summary', '样稿 · 查看发送参数'),
      el(
        'p',
        '模型　' +
          msg.model +
          '\n推理　' +
          msg.effort +
          '\n搜索　' +
          (msg.search ? '开' : '关') +
          '\n技能　' +
          (msg.skill?.name || '未选用')
      )
    )
    if (msg.skill) details.append(el('p', msg.skill.body))
    list.append(text, details)
  }
}
function send() {
  if (!draft.value.trim()) return
  conversation().messages.push({
    text: draft.value.trim(),
    model,
    effort: thinking ? levels[effort] : '关',
    search: search && model === 'Flash',
    skill: conversation().skill,
  })
  draft.value = conversation().draft = ''
  draft.blur()
  renderMessages()
  updateComposer()
  $('scroll').scrollTop = $('scroll').scrollHeight
}
$('sendBtn').onclick = send
draft.addEventListener('keydown', (e) => {
  if (
    e.key === 'Enter' &&
    !e.shiftKey &&
    !e.isComposing &&
    !matchMedia('(pointer:coarse)').matches
  ) {
    e.preventDefault()
    send()
  }
})
function switchThread(id) {
  conversation().scroll = $('scroll').scrollTop
  threadId = id
  $('example').hidden = id !== 'example'
  draft.value = conversation().draft
  renderMessages()
  closeSheet()
  updateComposer()
  $('scroll').scrollTop = conversation().scroll
}

function updateDial(raw) {
  const control = $('effort')
  control.value = raw
  control.style.setProperty('--fill', raw + '%')
  const label = levels[Math.round(raw / 50)]
  $('level').textContent = label
  control.setAttribute('aria-valuetext', label)
  $('dialModel').textContent = 'DeepSeek ' + model
}
function openDial(keyboard = false) {
  $('dialPanel').hidden = false
  $('reason').setAttribute('aria-expanded', 'true')
  updateDial(effort * 50)
  updateComposer()
  if (keyboard) $('effort').focus({ preventScroll: true })
}
function closeDial() {
  const focusInside = $('dialPanel').contains(document.activeElement)
  $('dialPanel').hidden = true
  $('reason').setAttribute('aria-expanded', 'false')
  if (focusInside) $('reason').focus({ preventScroll: true })
  updateComposer()
}
const gauge = $('reason')
let holdTimer
let longPress = false
let origin = null
function clearHold() {
  clearTimeout(holdTimer)
  origin = null
}
gauge.onpointerdown = (e) => {
  if (!e.isPrimary || e.button !== 0) return
  if (document.activeElement === draft) e.preventDefault()
  clearHold()
  longPress = false
  origin = [e.clientX, e.clientY]
  gauge.setPointerCapture(e.pointerId)
  holdTimer = setTimeout(() => {
    longPress = true
    openDial()
  }, 420)
}
gauge.onpointermove = (e) => {
  if (origin && Math.hypot(e.clientX - origin[0], e.clientY - origin[1]) > 10) {
    longPress = true
    clearHold()
  }
}
gauge.onpointercancel = () => {
  longPress = true
  clearHold()
}
gauge.onpointerup = clearHold
gauge.oncontextmenu = (e) => {
  e.preventDefault()
  clearHold()
  longPress = true
  openDial()
}
gauge.onkeydown = (e) => {
  if (e.key === 'ArrowUp') {
    e.preventDefault()
    openDial(true)
  }
}
gauge.onclick = (e) => {
  if (longPress && e.detail) {
    longPress = false
    return
  }
  if (!$('dialPanel').hidden) {
    closeDial()
    return
  }
  thinking = !thinking
  updateComposer()
}
$('dialClose').onclick = closeDial
const range = $('effort')
function commitEffort(raw) {
  effort = Math.round(raw / 50)
  thinking = true
  updateDial(effort * 50)
  updateComposer()
}
// Keep Safari's text focus while moving the dial above its keyboard.
function atPointer(e) {
  const rect = range.getBoundingClientRect()
  return Math.round(
    100 * Math.max(0, Math.min(1, (e.clientX - rect.left - 12.5) / (rect.width - 25)))
  )
}
range.onpointerdown = (e) => {
  if (!e.isPrimary || e.button !== 0) return
  e.preventDefault()
  range.setPointerCapture(e.pointerId)
  updateDial(atPointer(e))
}
range.onpointermove = (e) => {
  if (range.hasPointerCapture(e.pointerId)) updateDial(atPointer(e))
}
range.onpointerup = (e) => {
  if (range.hasPointerCapture(e.pointerId)) commitEffort(atPointer(e))
}
range.onpointercancel = () => updateDial(effort * 50)
range.onkeydown = (e) => {
  const targets = {
    ArrowRight: effort + 1,
    ArrowUp: effort + 1,
    ArrowDown: effort - 1,
    ArrowLeft: effort - 1,
    Home: 0,
    End: 2,
  }
  if (Object.hasOwn(targets, e.key)) {
    e.preventDefault()
    commitEffort(50 * Math.max(0, Math.min(2, targets[e.key])))
  }
}
range.oninput = () => updateDial(Number(range.value))
range.onchange = () => commitEffort(Number(range.value))
document.addEventListener('pointerdown', (e) => {
  if (!$('dialPanel').hidden && !$('dialPanel').contains(e.target) && !gauge.contains(e.target))
    closeDial()
})
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !$('dialPanel').hidden) {
    e.preventDefault()
    closeDial()
  }
})
function toggleSearch() {
  if (model === 'Flash') search = !search
  else tell('联网搜索需要 Flash')
  updateComposer()
  if (sheet.open) drawSheet()
}
$('search').onclick = toggleSearch

// Dialog navigation has its own history so Back returns to the caller.
function showPage(page, value) {
  const opening = !sheet.open
  if (opening) {
    restoreDraft = document.activeElement === draft
    dialogPages = []
    closeDial()
  }
  dialogPages.push({ page, value })
  drawSheet()
  if (opening) sheet.showModal()
  else $('sheetTitle').focus({ preventScroll: true })
}
function closeSheet() {
  if (sheet.open) sheet.close()
}
sheet.onclose = () => {
  dialogPages = []
  if (restoreDraft) draft.focus({ preventScroll: true })
  restoreDraft = false
  updateComposer()
}
sheet.onclick = (e) => {
  if (e.target !== sheet) return
  const r = sheet.getBoundingClientRect()
  if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)
    closeSheet()
}
$('sheetTitle').tabIndex = -1
$('closeSheet').onclick = closeSheet
$('backBtn').onclick = () => {
  if (dialogPages.length > 1) {
    dialogPages.pop()
    drawSheet()
    $('sheetTitle').focus()
  } else closeSheet()
}
$('navigation').onclick = () => showPage('menu')
$('add').onclick = () => showPage('plus')
$('skillPill').onclick = () => showPage('skills')
function chooseSkill(skill) {
  conversation().skill = skill
  updateComposer()
  closeSheet()
  tell(skill ? '已选用「' + skill.name + '」' : '已移除会话技能')
}
function drawSheet() {
  const { page, value } = dialogPages.at(-1)
  const names = {
    menu: '菜单',
    plus: '工具与模型',
    models: '选择模型',
    skills: '会话技能',
    library: '扩展',
    detail: '技能详情',
    import: '导入预览',
    theme: '外观',
  }
  $('sheetTitle').textContent = names[page]
  $('backBtn').hidden = dialogPages.length < 2
  const body = $('sheetBody')
  body.replaceChildren()
  function addRow(...args) {
    body.append(row(...args))
  }
  if (page === 'menu') {
    addRow('示例对话', 'book', () => switchThread('example'))
    addRow('空白对话', 'plus', () => switchThread('new'))
    addRow('扩展', 'grid', () => showPage('library', 'skills'))
    addRow('外观', 'moon', () => showPage('theme'), theme)
    body.append(el('p', '交互样稿 · 消息仅在本页演示，刷新会重置。', 'note'))
  } else if (page === 'plus') {
    addRow('模型', 'dial', () => showPage('models'), model)
    addRow('技能', 'book', () => showPage('skills'), conversation().skill?.name || '选择')
    addRow(
      '推理程度',
      'dial',
      () => {
        closeSheet()
        openDial(!restoreDraft)
      },
      thinking ? levels[effort] : '关'
    )
    addRow('扩展', 'grid', () => showPage('library', 'skills'))
  } else if (page === 'models' || page === 'theme') {
    const isModel = page === 'models'
    for (const item of isModel ? ['Flash', 'Pro'] : ['跟随系统', '浅色', '深色']) {
      const selected = item === (isModel ? model : theme)
      const b = row(item, isModel ? 'dial' : 'moon', () => {
        if (isModel) model = item
        else {
          theme = item
          updateTheme()
        }
        closeSheet()
        updateComposer()
      })
      b.setAttribute('aria-pressed', String(selected))
      if (selected) b.lastElementChild.replaceWith(icon('check'))
      body.append(b)
    }
  } else if (page === 'skills') {
    for (const s of skills)
      addRow(s.name, 'book', () => chooseSkill(s), s === conversation().skill ? '已选用' : '')
    if (conversation().skill) addRow('移除会话技能', 'close', () => chooseSkill(null))
    addRow('管理技能', 'grid', () => showPage('library', 'skills'))
  } else if (page === 'library') {
    const tabs = el('div', undefined, 'tabs')
    for (const [tab, title] of [
      ['skills', '我的技能'],
      ['tools', '官方工具'],
    ]) {
      const b = button(title, () => {
        dialogPages.at(-1).value = tab
        drawSheet()
        body.querySelector('[aria-pressed=true]')?.focus()
      })
      b.setAttribute('aria-pressed', String(tab === value))
      tabs.append(b)
    }
    body.append(tabs)
    if (value === 'tools') {
      addRow(
        '联网搜索',
        'globe',
        toggleSearch,
        model === 'Flash' ? (search ? '开启' : '关闭') : '需要 Flash'
      )
      for (const [title, desc] of [
        ['读链接', '发送含网址的消息时使用 Flash。'],
        ['文件与 OCR', '在正式版从加号添加照片或文件。'],
        ['语音', '正式版的麦克风负责听写，回复下方可朗读。'],
      ]) {
        const a = el('article')
        a.append(el('strong', title), el('p', desc))
        body.append(a)
      }
    } else {
      for (const s of skills) addRow(s.name, 'book', () => showPage('detail', s))
      const file = el('input')
      file.type = 'file'
      file.accept = '.md,text/markdown,text/plain'
      file.hidden = true
      const error = el('p', '', 'note')
      error.setAttribute('role', 'alert')
      file.onchange = async () => {
        const f = file.files[0]
        if (!f) return
        try {
          if (f.size > 65536) throw Error('请选择 64 KB 以内的单文件文字技能。')
          const skill = readSkill(await f.text())
          if (!sheet.open || !file.isConnected) return
          if (skills.some((s) => s.name === skill.name)) throw Error('同名技能已存在。')
          showPage('import', skill)
        } catch (e) {
          error.textContent = e.message
        }
        file.value = ''
      }
      addRow('导入 SKILL.md', 'plus', () => file.click())
      body.append(file, error)
    }
  } else if (page === 'detail' || page === 'import') {
    const article = el('article')
    article.append(el('h3', value.name), el('p', value.description), el('pre', value.body))
    const action =
      page === 'import'
        ? button(
            '添加到样稿',
            () => {
              skills.push(value)
              dialogPages.pop()
              drawSheet()
              tell('已添加技能')
            },
            'primary'
          )
        : button('在当前对话中选用', () => chooseSkill(value), 'primary')
    article.append(action)
    body.append(article)
  }
}
function readSkill(text) {
  const match = /^---\s*\n([\s\S]*?)\n---\s*\n([\s\S]+)$/.exec(
    text.replace(/^\uFEFF/, '').replace(/\r\n/g, '\n')
  )
  if (!match) throw Error('需要包含 name、description 以及正文的 SKILL.md。')
  const fields = {}
  for (const line of match[1].split('\n')) {
    const pair = /^(name|description):\s*(.+)$/.exec(line)
    if (pair) fields[pair[1]] = pair[2].trim().replace(/^(['"])(.*)\1$/, '$2')
    else if (line.trim() && !line.trim().startsWith('#'))
      throw Error('样稿支持 name、description 两个单行字段及独立文字正文。')
  }
  const body = match[2].trim()
  if (!fields.name || !fields.description || !body || /^[>|]/.test(fields.description))
    throw Error('请填写单行名称、说明与技能正文。')
  if (/(?:scripts|references|assets)[/\\]|\]\(\.\.?\//i.test(body))
    throw Error('这个技能引用了附带文件；样稿支持可独立使用的单文件文字技能。')
  return { ...fields, body }
}
setStyle(new URL(location.href).searchParams.get('style') === 'b' ? 'b' : 'a')

// A downward swipe on the sheet heading dismisses it, leaving lists free to scroll.
const sheetHead = sheet.querySelector('.sheet-head')
let swipeStart
sheetHead.onpointerdown = (e) => {
  if (e.button !== 0 || e.target.closest('button')) return
  swipeStart = e.clientY
  sheetHead.setPointerCapture(e.pointerId)
}
sheetHead.onpointerup = (e) => {
  if (swipeStart !== undefined && e.clientY - swipeStart > 50) closeSheet()
  swipeStart = undefined
}
sheetHead.onpointercancel = () => {
  swipeStart = undefined
}
