import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { LoginPage } from "./LoginPage";

describe("LoginPage", () => {
  it("enables sign in for valid credentials and reports success", async () => {
    const user = userEvent.setup();

    render(<LoginPage />);

    const submit = screen.getByRole("button", { name: "登入" });

    expect(submit).toBeDisabled();

    await user.type(screen.getByLabelText("電子郵件"), "anthea@example.com");
    await user.type(screen.getByPlaceholderText("至少 8 個字元"), "quota-gem-2026");

    expect(submit).toBeEnabled();

    await user.click(submit);

    expect(screen.getByText("正在建立安全工作階段...")).toBeInTheDocument();

    await waitFor(() => {
      expect(
        screen.getByText("已登入，這台裝置會保留工作階段。"),
      ).toBeInTheDocument();
    });
  });
});
