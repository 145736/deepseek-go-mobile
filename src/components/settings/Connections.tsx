import { useEffect, useRef, useState } from 'react'
import { Button } from '../base/Button.js'
import { Modal } from '../base/Modal.js'
import { showToast } from '../base/toastState.js'
import { openSettings } from './settingsDialogState.js'
import {
  forgetConnection,
  providers,
  regsEndpoint,
  repoPath,
  saveConnection,
  useConnections,
  type Provider,
} from '../../services/connections/config.js'
import { finishNotionAuth, startNotionAuth } from '../../services/connections/notionAuth.js'
import { pageId, verifyConnection } from '../../services/connections/providers.js'
import { useWriteReview } from '../../services/connections/confirmation.js'
export const isNotionReturn = new URLSearchParams(location.search).has('notion_callback')
function reason(e: unknown) {
  return e instanceof TypeError
    ? '浏览器无法直连。请检查网络，以及服务是否允许本站来源、Authorization 和 MCP 会话请求头。'
    : e instanceof Error
      ? e.message
      : '连接未完成'
}
export function ConnectionSettings() {
  const all = useConnections()
  const [selected, select] = useState<Provider | null>(isNotionReturn ? 'Notion' : null)
  if (selected) {
    return (
      <div>
        <button className="library-back" onClick={() => select(null)}>
          ‹ MCP
        </button>
        <ConnectionForm key={selected} provider={selected} />
      </div>
    )
  }
  return (
    <>
      {providers.map((p) => (
        <button key={p} type="button" className="library-row" onClick={() => select(p)}>
          <span>{p === 'regs' ? 'regs · 法规库' : p + ' · 官方 MCP'}</span>
          <small>
            {all[p].enabled && all[p].checked
              ? '已启用'
              : all[p].checked
                ? '已停用'
                : all[p].token
                  ? '待验证'
                  : '连接'}{' '}
            ›
          </small>
        </button>
      ))}
    </>
  )
}
function ConnectionForm({ provider: p }: { provider: Provider }) {
  const config = useConnections((s) => s[p])
  const [target, setTarget] = useState(config.target)
  const [token, setToken] = useState(config.token)
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const validate = async () => {
    setBusy(true)
    setMessage('')
    try {
      const normalized =
        p === 'GitHub'
          ? repoPath(target)
          : p === 'regs'
            ? regsEndpoint(target)
            : target.trim()
              ? pageId(target)
              : ''
      const c = {
        ...config,
        target: normalized,
        token: p === 'Notion' ? config.token : token.trim(),
      }
      await verifyConnection(p, c)
      saveConnection(p, {
        ...(p === 'Notion' ? useConnections.getState().Notion : c),
        target: normalized,
        enabled: true,
        checked: Date.now(),
      })
      setTarget(normalized)
      setMessage('读取验证成功。聊天中可用 @' + p + ' 点名。')
    } catch (e) {
      setMessage(reason(e))
    } finally {
      setBusy(false)
    }
  }
  return (
    <form
      className="extension-form"
      onSubmit={(e) => {
        e.preventDefault()
        void validate()
      }}
    >
      <h3>{p}</h3>
      {p === 'Notion' && (
        <Button
          type="button"
          disabled={busy}
          onClick={() => {
            setBusy(true)
            void startNotionAuth().catch((e) => {
              setMessage(reason(e))
              setBusy(false)
            })
          }}
        >
          {config.token ? '重新授权 Notion' : '在 Notion 中授权'}
        </Button>
      )}
      <label>
        {p === 'GitHub'
          ? '目标仓库'
          : p === 'Notion'
            ? '常用父页面链接或 ID（选填）'
            : '法规库 HTTPS MCP 地址'}
        <input
          value={target}
          disabled={busy}
          onChange={(e) => {
            if (p === 'regs' && token) {
              setToken('')
            }
            setTarget(e.target.value)
          }}
          placeholder={
            p === 'GitHub'
              ? '145736/deepseek-go-mobile'
              : p === 'regs'
                ? 'https://…/mcp'
                : 'Notion 页面链接'
          }
          autoCapitalize="none"
          spellCheck={false}
        />
      </label>
      {p !== 'Notion' && (
        <label>
          {p === 'GitHub' ? 'GitHub 细粒度访问令牌' : '访问令牌'}
          <input
            type="password"
            autoComplete="off"
            value={token}
            disabled={busy}
            onChange={(e) => setToken(e.target.value)}
          />
        </label>
      )}
      {p === 'GitHub' && (
        <small>
          只选择目标仓库。读取提交和 README 需要 Contents 只读，读取 PR 需要 Pull requests
          只读，创建 Issue 需要 Issues 读写。{' '}
          <a
            href="https://github.com/settings/personal-access-tokens/new"
            target="_blank"
            rel="noreferrer"
          >
            创建令牌
          </a>
        </small>
      )}
      {p === 'regs' && (
        <small>
          当前法规库入口拒绝本站的跨域请求。若服务已允许本站来源并公开 MCP 会话编号，可重新验证。
        </small>
      )}
      <Button type="submit" disabled={busy || (p === 'Notion' && !config.token)}>
        {busy ? '正在连接…' : '验证读取并启用'}
      </Button>
      {config.checked > 0 && (
        <label className="library-row">
          允许聊天使用
          <input
            type="checkbox"
            role="switch"
            checked={config.enabled}
            disabled={busy}
            onChange={(e) => saveConnection(p, { ...config, enabled: e.target.checked })}
          />
        </label>
      )}
      {(config.checked > 0 || config.token) && (
        <Button
          type="button"
          disabled={busy}
          variant="outlined"
          onClick={() => {
            forgetConnection(p)
            setToken('')
            setTarget('')
            setMessage('已从本浏览器断开。')
          }}
        >
          断开连接
        </Button>
      )}
      <p role="status">{message}</p>
    </form>
  )
}
export function ConnectionDialogs() {
  const review = useWriteReview((s) => s.review)
  const initialized = useRef(false)
  useEffect(() => {
    if (initialized.current || !isNotionReturn) {
      return
    }
    initialized.current = true
    void (async () => {
      try {
        await finishNotionAuth()
        const c = useConnections.getState().Notion
        await verifyConnection('Notion', c)
        saveConnection('Notion', {
          ...useConnections.getState().Notion,
          enabled: true,
          checked: Date.now(),
        })
        showToast('Notion 已连接，读取验证成功。')
      } catch (e) {
        showToast(reason(e))
      }
      openSettings('extensions')
    })()
  }, [])
  return review ? <WriteReview review={review} /> : null
}
function WriteReview({
  review,
}: {
  review: NonNullable<ReturnType<typeof useWriteReview.getState>['review']>
}) {
  const [draft, setDraft] = useState(review.draft)
  const [error, setError] = useState('')
  return (
    <Modal
      title={draft.provider === 'GitHub' ? '创建 GitHub Issue' : '保存到 Notion'}
      onClose={() => review.finish(null)}
      closable
    >
      <form className="extension-form" onSubmit={(e) => e.preventDefault()}>
        <label>
          {draft.provider === 'GitHub' ? '仓库' : '父页面链接或 ID'}
          <input
            required
            readOnly={draft.provider === 'GitHub'}
            value={draft.target}
            onChange={(e) => setDraft({ ...draft, target: e.target.value })}
          />
        </label>
        <label>
          标题
          <input
            required
            maxLength={256}
            value={draft.title}
            onChange={(e) => setDraft({ ...draft, title: e.target.value })}
          />
        </label>
        <label>
          正文
          <textarea
            required
            rows={7}
            value={draft.body}
            onChange={(e) => setDraft({ ...draft, body: e.target.value })}
          />
        </label>
        {error && <p role="alert">{error}</p>}
        <Button
          type="button"
          disabled={!draft.title.trim() || !draft.body.trim() || !draft.target.trim()}
          onClick={() => {
            try {
              if (draft.provider === 'Notion') {
                pageId(draft.target)
              }
              review.finish({ ...draft })
            } catch (err) {
              setError(reason(err))
            }
          }}
        >
          确认提交到 {draft.provider}
        </Button>
        <Button type="button" variant="outlined" onClick={() => review.finish(null)}>
          取消
        </Button>
      </form>
    </Modal>
  )
}
