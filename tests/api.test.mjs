import { test, afterEach } from 'node:test'
import assert from 'node:assert/strict'
import { request, streamMessage, uploadFile, verifyApiKey } from '../src/services/api/client.ts'
import { transcribe, synthesize } from '../src/services/api/speech.ts'
import { readServerSentEvents } from '../src/services/api/sse.ts'
const originalFetch = globalThis.fetch
const mockKey = 'test-only-not-a-real-key'
afterEach(() => {
  globalThis.fetch = originalFetch
})
const collect = async (iterator) => {
  const out = []
  for await (const x of iterator) out.push(x)
  return out
}
const sse = (events) =>
  new Response(events.map((x) => `data: ${JSON.stringify(x)}\n\n`).join(''), {
    headers: { 'Content-Type': 'text/event-stream' },
  })

test('credentials are never sent to another origin', async () => {
  let called = false
  globalThis.fetch = async () => {
    called = true
  }
  await assert.rejects(
    request('https://example.com/models', { headers: { Authorization: mockKey } }),
    /official DeepSeek/
  )
  assert.equal(called, false)
})
test('key verification is a direct GET without cookies or redirects', async () => {
  globalThis.fetch = async (url, init) => {
    assert.equal(url, 'https://api.deepseek.com/models')
    assert.equal(init.headers.Authorization, `Bearer ${mockKey}`)
    assert.equal(init.credentials, 'omit')
    assert.equal(init.redirect, 'error')
    assert.equal(init.method, 'GET')
    return new Response('{}')
  }
  await verifyApiKey(mockKey)
})
test('chat preserves tool results and declares official tools in the request', async () => {
  const signed = {
    type: 'web_search_tool_result',
    tool_use_id: 'tool1',
    kind: 'search',
    content: [
      {
        type: 'web_search_result',
        title: 'Source',
        url: 'https://example.org',
        encrypted_content: 'opaque-original',
      },
    ],
  }
  const body = {
    model: 'deepseek-flash',
    messages: [
      { role: 'assistant', content: [signed] },
      { role: 'user', content: 'Continue' },
    ],
    thinking: { type: 'enabled' },
    safety_check: { level: 'high' },
    tools: [
      { type: 'deepseek_web_search', name: 'deepseek_web_search' },
      { type: 'deepseek_read_url', name: 'deepseek_read_url' },
    ],
  }
  globalThis.fetch = async (url, init) => {
    assert.equal(url, 'https://api.deepseek.com/anthropic/v1/messages')
    const sent = JSON.parse(init.body)
    assert.deepEqual(sent.messages[0].content[0], signed)
    assert.equal(sent.stream, true)
    assert.deepEqual(sent.tools, body.tools)
    return sse([{ type: 'message_stop' }])
  }
  assert.equal(
    (await collect(streamMessage(mockKey, body, new AbortController().signal))).at(-1).type,
    'message_stop'
  )
})
test('truncated streams report interruption instead of fake success', async () => {
  globalThis.fetch = async () =>
    sse([
      { type: 'content_block_start', index: 0, content_block: { type: 'text', text: 'partial' } },
    ])
  await assert.rejects(
    collect(streamMessage(mockKey, { messages: [] }, new AbortController().signal)),
    (e) => e.kind === 'interrupted'
  )
})
test('401 is available to the UI as an authentication error', async () => {
  globalThis.fetch = async () =>
    new Response(JSON.stringify({ error: { message: 'Invalid key' } }), { status: 401 })
  await assert.rejects(verifyApiKey(mockKey), (e) => e.status === 401 && e.kind === 'http')
})
test('UTF-8 Chinese text survives one-byte network chunks', async () => {
  const bytes = new TextEncoder().encode('event: content_block_delta\r\ndata: 中文测试\r\n\r\n')
  const stream = new ReadableStream({
    start(c) {
      for (const b of bytes) c.enqueue(new Uint8Array([b]))
      c.close()
    },
  })
  assert.deepEqual(
    (await collect(readServerSentEvents(stream))).map((x) => x.data),
    ['中文测试']
  )
})
test('documents upload unchanged to official Files API', async () => {
  const original = new File(['raw test PDF bytes'], 'test.pdf', { type: 'application/pdf' })
  globalThis.fetch = async (url, init) => {
    assert.equal(url, 'https://api.deepseek.com/anthropic/v1/files')
    assert.equal(init.headers['anthropic-beta'], 'files-api-2025-04-14')
    assert.deepEqual([...init.body.keys()], ['purpose', 'file'])
    assert.equal(await init.body.get('file').text(), await original.text())
    return Response.json({ id: 'file-test', type: 'file' })
  }
  assert.equal((await uploadFile(mockKey, original, 'rich_layout_recognition')).id, 'file-test')
})
test('ASR only uploads audio to DeepSeek and returns its transcript', async () => {
  globalThis.fetch = async (url, init) => {
    assert.equal(url, 'https://api.deepseek.com/v1/tools/asr')
    assert.equal(init.body.get('file').name, 'recording.wav')
    return Response.json({ text: '语音测试' })
  }
  assert.equal(await transcribe(mockKey, new Blob(['test audio'])), '语音测试')
})
test('TTS uses official PCM audio endpoint and selected voice', async () => {
  globalThis.fetch = async (url, init) => {
    assert.equal(url, 'https://api.deepseek.com/v1/tools/tts')
    assert.deepEqual(JSON.parse(init.body), {
      text: '测试',
      voice_id: 'stella',
      format: 'pcm',
      filter_markdown: true,
    })
    return new Response(new Uint8Array([0, 0, 1, 0]))
  }
  assert.ok(await synthesize(mockKey, '测试', 'stella', new AbortController().signal))
})
test('key cannot appear saved if localStorage write fails', async () => {
  const { setApiKey, useSettings } = await import('../src/services/settings.ts')
  const old = useSettings.getState().apiKey
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: {
      setItem() {
        throw new Error('Storage unavailable')
      },
    },
  })
  assert.throws(() => setApiKey(mockKey), /Storage unavailable/)
  assert.equal(useSettings.getState().apiKey, old)
  delete globalThis.localStorage
})
