# Verification — 2026-11-17

## Passed

- Cloned the official deepseek-ai/chat-demo repository; upstream commit `5d5dd754ebc1948e977ddb880a9eb5aa25f37b4c` recorded in README; this public repository starts with a sanitized derivative snapshot.
- `pnpm type`: TypeScript passes.
- `pnpm lint`: no errors or warnings.
- `pnpm build`: production static output builds on Windows.
- `pnpm test`: 10 isolated API tests pass. Coverage includes allowed origin enforcement, key verification, server tool block round-trip, interrupted stream, 401, fragmented UTF-8 SSE, original document multipart upload, official ASR/TTS endpoints, failed localStorage key write.
- Impeccable detector explicitly run on changed UI files: zero anti-pattern failures. Advisory notes concern inherited upstream radii/colors not fully represented by the compact design token documentation; native hooks are not claimed active.
- Chrome extension browser preview at 390x844, 375x667, 320x568, and a shortened 390x400 viewport. No page-level horizontal overflow. Small-screen chat controls and settings sheet remain reachable. Light/dark themes inspected; textareas use 16px, send control is 44x44, touch buttons have a 44px target minimum.
- Isolated browser interception: entered a dummy key, intercepted `/models`, intercepted the chat request and supplied a labeled simulated SSE reply. Actual UI request used deepseek-flash, thinking enabled, safety_check high, deepseek_web_search and deepseek_read_url. Verified thinking/text rendering and title, then reloaded and reopened persisted conversation from local history.
- Real unauthenticated OPTIONS against `https://api.deepseek.com/anthropic/v1/messages`, Origin `https://deepseek-go-mobile.swx.chatgpt.site`: HTTP 200, echoed allowed origin and requested content-type / x-api-key / anthropic-beta headers. This verifies CORS preflight, not authenticated inference.

## Limits

No real user API key was supplied. No paid inference, real server file parsing/OCR, real microphone transcription, or real speech playback was claimed successful. ASR/TTS paths and transport are tested with mocks and retained official code. iPhone Safari hardware keyboard, microphone permission and standalone install need real-device acceptance. A resized Chromium viewport is not an iPhone/WebKit test.

The manifest and Apple icons support Add to Home Screen; no service worker or offline inference is claimed. Static hosting and local record persistence do not eliminate DeepSeek usage charges or browser storage eviction.
