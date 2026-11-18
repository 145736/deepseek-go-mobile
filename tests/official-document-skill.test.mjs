import assert from 'node:assert/strict'
import { test } from 'node:test'
import { officialDocumentSkill } from '../src/services/builtins/officialDocument.ts'

test('upstream updates preserve the local consolidated-report contribution rules', () => {
  const { body, description } = officialDocumentSkill
  const section = body.match(
    /^## Contribution Paragraph for a Consolidated Report\r?\n([\s\S]*?)(?=^## )/m
  )?.[1]
  assert.ok(section, 'Missing local contribution-paragraph section')
  for (const rule of [
    '给领导整合',
    'A general request for 汇报材料 alone does not trigger this mode',
    'one continuous paragraph',
    'confirmed unit or department name in the third person',
    'preserve and state the original source definitions',
    '〔待核实：……〕',
    'Never invent problems, achievements, or plans',
    '200–300 Chinese characters',
  ]) {
    assert.ok(section.includes(rule), 'Missing local rule: ' + rule)
  }
  assert.match(description, /汇报素材/)
  assert.ok(body.includes('汇报素材段落（供整合）'))
  assert.ok(
    body.includes('For a requested contribution paragraph, is it pasteable as one paragraph')
  )
})
