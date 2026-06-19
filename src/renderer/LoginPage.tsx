import { useMemo, useState } from "react";
import type { FormEvent } from "react";

type LoginState = "idle" | "submitting" | "signed-in";

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberSession, setRememberSession] = useState(true);
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [loginState, setLoginState] = useState<LoginState>("idle");
  const [message, setMessage] = useState("");

  const canSubmit = useMemo(
    () => isValidEmail(email) && password.length >= 8 && loginState !== "submitting",
    [email, loginState, password],
  );

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!isValidEmail(email)) {
      setMessage("請輸入有效的電子郵件。");
      return;
    }

    if (password.length < 8) {
      setMessage("密碼至少需要 8 個字元。");
      return;
    }

    setLoginState("submitting");
    setMessage("正在建立安全工作階段...");

    window.setTimeout(() => {
      setLoginState("signed-in");
      setMessage(
        rememberSession
          ? "已登入，這台裝置會保留工作階段。"
          : "已登入，本次關閉後不會保留工作階段。",
      );
    }, 650);
  }

  return (
    <main className="login-page">
      <div className="login-page__grain" aria-hidden="true" />
      <section className="login-panel" aria-labelledby="login-heading">
        <div className="login-panel__brand">
          <img src="/quota-gem-mark.svg" alt="" className="login-panel__mark" />
          <span>QuotaGem</span>
        </div>

        <div className="login-panel__intro">
          <p className="login-panel__eyebrow">Secure quota console</p>
          <h1 id="login-heading">登入你的配額儀表板</h1>
          <p>
            串接 Claude 與 Codex 用量，讓工作階段、週期額度與提醒在同一個精準畫面裡同步。
          </p>
        </div>

        <form className="login-form" onSubmit={handleSubmit} noValidate>
          <label className="login-field">
            <span>電子郵件</span>
            <input
              type="email"
              name="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => {
                setEmail(event.target.value);
                setMessage("");
              }}
            />
          </label>

          <label className="login-field">
            <span>密碼</span>
            <div className="login-field__password">
              <input
                type={passwordVisible ? "text" : "password"}
                name="password"
                autoComplete="current-password"
                placeholder="至少 8 個字元"
                value={password}
                onChange={(event) => {
                  setPassword(event.target.value);
                  setMessage("");
                }}
              />
              <button
                type="button"
                aria-label={passwordVisible ? "隱藏密碼" : "顯示密碼"}
                onClick={() => {
                  setPasswordVisible((current) => !current);
                }}
              >
                {passwordVisible ? "Hide" : "Show"}
              </button>
            </div>
          </label>

          <div className="login-form__meta">
            <label className="login-check">
              <input
                type="checkbox"
                checked={rememberSession}
                onChange={(event) => {
                  setRememberSession(event.target.checked);
                }}
              />
              <span>記住這台裝置</span>
            </label>
            <a href="#reset">忘記密碼？</a>
          </div>

          <button className="login-form__submit" type="submit" disabled={!canSubmit}>
            {loginState === "submitting" ? "登入中" : "登入"}
          </button>

          <p className="login-form__status" aria-live="polite">
            {message || "使用公司信箱登入後即可同步本機用量。"}
          </p>
        </form>
      </section>

      <aside className="login-sidecar" aria-label="QuotaGem status preview">
        <div className="login-sidecar__header">
          <span>Live budget</span>
          <strong>84%</strong>
        </div>
        <div className="login-meter" aria-hidden="true">
          <span />
        </div>
        <div className="login-orbit" aria-hidden="true">
          <span className="login-orbit__node login-orbit__node--claude">Claude</span>
          <span className="login-orbit__core">QG</span>
          <span className="login-orbit__node login-orbit__node--codex">Codex</span>
        </div>
        <dl className="login-sidecar__stats">
          <div>
            <dt>Session reset</dt>
            <dd>04:30 UTC</dd>
          </div>
          <div>
            <dt>Alert mode</dt>
            <dd>Smart</dd>
          </div>
          <div>
            <dt>Sync health</dt>
            <dd>Ready</dd>
          </div>
        </dl>
      </aside>
    </main>
  );
}
