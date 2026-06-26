import React from "react";
import ReactDOM from "react-dom/client";
import { invoke } from "@tauri-apps/api/core";
import "../ipc";
import App from "./App";

// === 診斷儀器（暫時）===
// 前端 React 例外過去完全沒被記錄（無 ErrorBoundary、無 window.onerror），
// 導致透明視窗在 render 崩潰時整片空白＝看起來像「app 跳掉」。
// 這裡把任何前端例外回寫後端 debug.log，並用 ErrorBoundary 渲染可見 fallback。
function reportFrontendError(stage: string, err: unknown): void {
  let msg: string;
  if (err instanceof Error) {
    msg = `${err.name}: ${err.message}\n${err.stack ?? "<no-stack>"}`;
  } else if (typeof err === "string") {
    msg = err;
  } else {
    try {
      msg = JSON.stringify(err);
    } catch {
      msg = String(err);
    }
  }
  try {
    void invoke("log_frontend_error", { message: `[${stage}] ${msg}` });
  } catch {
    /* 後端不可用時靜默吞掉，避免儀器本身再炸 */
  }
}

window.addEventListener("error", (event) => {
  reportFrontendError("window.onerror", event.error ?? event.message);
});
window.addEventListener("unhandledrejection", (event) => {
  reportFrontendError("unhandledrejection", event.reason);
});

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; message: string }
> {
  state = { hasError: false, message: "" };

  static getDerivedStateFromError(error: unknown) {
    const message =
      error instanceof Error ? `${error.name}: ${error.message}` : String(error);
    return { hasError: true, message };
  }

  componentDidCatch(error: unknown, info: { componentStack?: string }) {
    reportFrontendError(
      "ErrorBoundary",
      `${error instanceof Error ? error.stack ?? error.message : String(error)}\n--- componentStack ---${info.componentStack ?? ""}`,
    );
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          style={{
            padding: "12px",
            font: "12px/1.4 system-ui, sans-serif",
            color: "#fff",
            background: "rgba(120,20,20,0.92)",
            borderRadius: "8px",
            margin: "8px",
          }}
        >
          QuotaGem render error (logged to debug.log):
          <br />
          {this.state.message}
        </div>
      );
    }
    return this.props.children;
  }
}

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
