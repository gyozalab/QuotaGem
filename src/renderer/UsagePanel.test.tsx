import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import type { NormalizedProviderUsage } from "../shared/usage";

const providers: NormalizedProviderUsage[] = [
  {
    provider: "claude",
    displayName: "Claude",
    health: "available",
    session: {
      label: "Session",
      percent: 35,
      resetLabel: "2026-01-25 05:00 UTC",
      level: "normal",
    },
    weekly: {
      label: "Weekly",
      percent: 22,
      resetLabel: "2026-01-31 01:00 UTC",
      level: "normal",
    },
    lastUpdated: "2026-03-28T03:00:00.000Z",
  },
  {
    provider: "codex",
    displayName: "Codex",
    health: "unavailable",
    session: {
      label: "Session",
      percent: 0,
      resetLabel: "Unavailable",
      level: "normal",
    },
    weekly: {
      label: "Weekly",
      percent: 0,
      resetLabel: "Unavailable",
      level: "normal",
    },
    lastUpdated: "",
  },
];

describe("UsagePanel", () => {
  it("renders the expanded panel with both providers visible and exposes compact, refresh, settings, and close actions", async () => {
    const rendererModule = await import("./UsagePanel");
    const UsagePanel = Reflect.get(rendererModule, "UsagePanel");

    expect(typeof UsagePanel).toBe("function");

    if (typeof UsagePanel !== "function") {
      return;
    }

    const onRefresh = vi.fn();
    const onOpenSettings = vi.fn();
    const onOpenExpanded = vi.fn();
    const onOpenCompact = vi.fn();
    const onClose = vi.fn();

    render(
      <UsagePanel
        mode="expanded"
        providers={providers}
        language="en"
        loading={false}
        lastUpdatedLabel="Updated just now"
        onRefresh={onRefresh}
        onOpenSettings={onOpenSettings}
        onOpenExpanded={onOpenExpanded}
        onOpenCompact={onOpenCompact}
        onClose={onClose}
      />,
    );

    expect(screen.getAllByText("Claude").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Codex").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Session")).toHaveLength(2);
    expect(screen.getAllByText("Weekly")).toHaveLength(2);
    expect(screen.getAllByText("Unavailable").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Updated just now").length).toBeGreaterThan(0);
    expect(screen.getAllByRole("button")).toHaveLength(4);
    await userEvent.click(screen.getByRole("button", { name: "Open compact usage panel" }));
    await userEvent.click(screen.getByRole("button", { name: "Refresh usage" }));
    await userEvent.click(screen.getByRole("button", { name: "Open settings" }));
    await userEvent.click(screen.getByRole("button", { name: "Hide panel" }));

    expect(onOpenCompact).toHaveBeenCalledTimes(1);
    expect(onRefresh).toHaveBeenCalledTimes(1);
    expect(onOpenSettings).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onOpenExpanded).not.toHaveBeenCalled();
  });

  it("uses the compact QuotaGem three-dot mark in the expanded header", async () => {
    const rendererModule = await import("./UsagePanel");
    const UsagePanel = Reflect.get(rendererModule, "UsagePanel");

    expect(typeof UsagePanel).toBe("function");

    if (typeof UsagePanel !== "function") {
      return;
    }

    const { container } = render(
      <UsagePanel
        mode="expanded"
        providers={providers}
        language="en"
        loading={false}
        lastUpdatedLabel="Updated just now"
      />,
    );

    const mark = container.querySelector(".panel-header__mark");

    expect(mark).toBeInTheDocument();
    expect(mark).toHaveAttribute("viewBox", "0 0 64 64");

    const circles = Array.from(mark?.querySelectorAll("circle") ?? []);

    expect(circles).toHaveLength(3);
    expect(circles[0]).toHaveAttribute("cx", "23");
    expect(circles[0]).toHaveAttribute("cy", "31");
    expect(circles[0]).toHaveAttribute("r", "7.2");
    expect(circles[1]).toHaveAttribute("cx", "34");
    expect(circles[1]).toHaveAttribute("cy", "20");
    expect(circles[1]).toHaveAttribute("r", "4.1");
    expect(circles[2]).toHaveAttribute("cx", "37");
    expect(circles[2]).toHaveAttribute("cy", "40");
    expect(circles[2]).toHaveAttribute("r", "5.4");
  });

  it("renders the compact widget and opens the expanded panel on click", async () => {
    const rendererModule = await import("./UsagePanel");
    const UsagePanel = Reflect.get(rendererModule, "UsagePanel");

    expect(typeof UsagePanel).toBe("function");

    if (typeof UsagePanel !== "function") {
      return;
    }

    const onOpenExpanded = vi.fn();
    const onClose = vi.fn();

    render(
      <UsagePanel
        mode="compact"
        providers={providers}
        language="en"
        loading={false}
        lastUpdatedLabel="Updated just now"
        onOpenExpanded={onOpenExpanded}
        onClose={onClose}
      />,
    );

    expect(screen.getByRole("button", { name: "Open expanded usage panel" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hide panel" })).toBeInTheDocument();
    expect(screen.getByText("Claude")).toBeInTheDocument();
    expect(screen.getByText("Codex")).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: "Open expanded usage panel" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Hide panel" }));

    expect(onOpenExpanded).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
