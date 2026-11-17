# DeepSeek 随行

<!-- impeccable:product-schema 1 -->

## Platform
web

## Stack
沿用用户指定的 deepseek-ai/chat-demo：React 18、TypeScript、Rspack、Zustand、IndexedDB。构建输出为纯静态文件。

## Users
iPhone Safari 用户，在手机上使用自己的 DeepSeek API Key 聊天。

## Product Purpose
将 DeepSeek 官方开源聊天示例二次开发为适合手机的个人聊天工具。

## Capabilities and Constraints
仅直连 DeepSeek 官方 API，默认 deepseek-flash。搜索、深度思考搜索、读链接、文件解析、OCR、安全校验在官方服务端执行；语音输入和朗读调用官方 ASR/TTS。前端只录音、上传、展示、播放，不实现识别或解析模型。
API Key 仅保存在浏览器 localStorage；聊天记录与附件沿用本地 IndexedDB。无应用后端、无云数据库，不租服务器。静态发布目标待用户选择。

## Brand Commitments
用户指定参考 LobeChat UI：清晰、简洁、克制的界面层级。采用 DeepSeek 蓝色强调。非 DeepSeek 官方产品。

## Evidence on Hand
上游 https://github.com/deepseek-ai/chat-demo ，提交 5d5dd754ebc1948e977ddb880a9eb5aa25f37b4c。官方 2026-11-13 全家桶文档已核验。没有用户 API Key，真实付费推理与 iPhone 真机验证不能冒充已完成。

## Product Principles
主线聚焦聊天；保留官方协议实现；设置简单可找；本地数据可导出；不会将模拟测试作为真实调用成功。
