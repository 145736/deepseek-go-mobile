# DeepSeek 随行

基于 [DeepSeek 官方 chat-demo](https://github.com/deepseek-ai/chat-demo) v0.1.1 二次开发，UI 参考 LobeChat，当前优先服务 iPhone Safari。

## iPhone 使用

1. 用 Safari 打开 https://145736.github.io/deepseek-go-mobile/ ，无需 ChatGPT 或 GitHub 登录。
2. 点击右上角「设置」→「连接服务」，填写自己的 DeepSeek API Key，点「确定」。校验调用官方 `/models` 接口。
3. 回到聊天页发送消息。深度思考、智能搜索分别开关；同时开启就是深度思考搜索。链接直接粘贴到消息里即可。
4. 回形针上传图片、PDF、Office 等文件。麦克风录音后由官方 ASR 转写；回复下方的朗读按钮调用官方 TTS。
5. Safari「分享」→「添加到主屏幕」。语音输入需要 HTTPS 和麦克风权限。网页能添加到主屏幕，但并不提供离线 AI 服务。

## 数据与费用

- Key 只写入本浏览器 localStorage，不进入代码、服务器环境变量、聊天导出或部署包。请求只发送至官方 `api.deepseek.com`，禁止携带身份信息跳转其他源。
- 聊天和附件保留官方 IndexedDB 本地存储。清除浏览器数据、换浏览器或换网址不会自动迁移记录；请在「数据管理」导出备份。Safari 与主屏幕应用如出现独立存储，请在实际使用入口填写 Key。
- 发送消息、文件或音频时，内容会上传 DeepSeek 处理。前端不实现搜索、爬虫、文档解析、OCR、ASR 模型或 TTS 模型。录音采样、上传和音频播放沿用官方示例。
- 静态托管不需要租用应用服务器；DeepSeek API 按你自己的账户计费，免费网址不等于免费模型调用。
- 历史导入替换本地记录前有确认；导出包含对话及可用的原始图片，不包含 Key，也不包含非图片原始附件。详见 `src/services/chat/history/README.md`。

## 开发与构建

保留上游 React 18 + TypeScript + Rspack + Zustand 架构。需要 Node.js 22.15+、pnpm 11+。

```sh
pnpm install --frozen-lockfile
pnpm dev
pnpm test
pnpm type
pnpm lint
pnpm build
```

本地预览 `http://localhost:8090/`。成品是 `dist/` 整个目录，可迁移到任何 HTTPS 静态托管。`dist/index.html` 直接本地打开受浏览器 file:// 存储/跨域限制，iPhone 应使用 HTTPS 网址。

`pnpm-workspace.yaml` 仅允许开发测试依赖 esbuild 的安装脚本。页面没有任何第三方模型 SDK。GitHub Pages 从 `gh-pages` 分支发布已构建的静态文件，无业务后端。发布步骤见 `docs/DEPLOYMENT.md`。

## 官方接口

| 能力 | 官方实现 |
| --- | --- |
| 对话 | `/anthropic/v1/messages`，默认 `deepseek-flash` |
| 搜索 | `tools` 中声明 `deepseek_web_search` |
| 读链接 | 始终声明 `deepseek_read_url` |
| 深度思考搜索 | thinking enabled + web search |
| 安全校验 | `safety_check: { level: "high" }` |
| 文件与 OCR | `/anthropic/v1/files`，PDF/Office 使用 `rich_layout_recognition` |
| 语音转写 | `/v1/tools/asr` |
| 朗读 | `/v1/tools/tts` |

官方依据：[2026-11-13 发布说明](https://api-docs.deepseek.com/news/news261113/) · [构建聊天机器人](https://api-docs.deepseek.com/guides/build_a_chatbot/)。

## 来源与验证

上游提交 `5d5dd754ebc1948e977ddb880a9eb5aa25f37b4c`。MIT 许可证保留，原版 README 在 `docs/`。LobeChat 仅为视觉参考，没有复制其代码。非 DeepSeek 官方客户端。

自动化与浏览器验证记录见 `docs/VERIFICATION.md`；未用用户真实 Key 做付费调用，未完成 iPhone 真机录音/朗读验收。
