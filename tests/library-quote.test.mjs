import assert from 'node:assert/strict'
import { test } from 'node:test'
import { toRequestMessages } from '../src/services/chat/reply.ts'

test('a quoted selection stays within the user turn and survives history replay', () => {
  const user = { id:'u', role:'user', content:'解释一下', quote:'第一段\n第二段', files:[] }
  const reply = { id:'a',role:'assistant',status:'done',blocks:[{type:'text',text:'回答'}] }
  const expected = {role:'user',content:'> 第一段\n> 第二段\n\n解释一下'}
  assert.deepEqual(toRequestMessages([], user), [expected])
  const next = {...user,id:'u2',content:'继续',quote:undefined}
  assert.deepEqual(toRequestMessages([user,reply],next)[0], expected)
  assert.deepEqual(toRequestMessages([], next)[0], {role:'user',content:'继续'})
})

test('disabling and enabling again invalidates previous session and default selections', async () => {
  const values = new Map()
  const storage = {get length(){return values.size},key:i=>Array.from(values.keys())[i],getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)}
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:storage})
  const { defaultSkill, useSkills, availableSkill, enableSkill, setDefaultSkill } = await import('../src/services/skills.ts')
  assert.equal(availableSkill(defaultSkill.id),defaultSkill)
  setDefaultSkill(defaultSkill.id)
  const original = useSkills.getState().defaultRef
  enableSkill(defaultSkill,false)
  assert.equal(availableSkill(original),undefined)
  enableSkill(defaultSkill,true)
  assert.equal(availableSkill(original),undefined)
  assert.equal(availableSkill(useSkills.getState().choices[defaultSkill.id]),defaultSkill)
})
