# GitHub Pages 发布

- 网页：https://145736.github.io/deepseek-go-mobile/
- 源码：https://github.com/145736/deepseek-go-mobile
- `main` 保存源码；`gh-pages` 保存构建产物。仓库 Settings → Pages 的来源为 `gh-pages` 分支根目录。
- 更新时先运行 `pnpm install --frozen-lockfile`、`pnpm test`、`pnpm type`、`pnpm lint`、`pnpm build`，再把完整 `dist/` 发布到 `gh-pages` 根目录，保留 `.nojekyll`。不能只上传 index.html。
- 页面没有部署环境密钥。用户在设置里输入自己的 DeepSeek Key，保存在本浏览器；不要将 Key 提交到仓库。
- Safari 打开网页后，点击「分享」→「添加到主屏幕」。本地下载的 index.html 不是 iPhone 安装包。
- 原 chatgpt.site 地址的数据不会自动迁移；可通过原页面的数据管理导出，再在新页面导入。Key 需要在新地址重新填写。
- 免费静态托管不包括 DeepSeek API 费用；AI 功能仍需要联网。没有 service worker，不能保证离线打开页面。

此仓库以官方上游 `5d5dd754ebc1948e977ddb880a9eb5aa25f37b4c` 为基础，保留 MIT 许可证，独立发布前端衍生版本。
