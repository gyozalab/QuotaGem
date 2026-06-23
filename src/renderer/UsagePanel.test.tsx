import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterAll, beforeAll, vi } from "vitest";

import type { NormalizedProviderUsage } from "../shared/usage";

const providers: NormalizedProviderUsage[] = [
  {
    provider: "claude",
    displayName: "Claude",
    health: "available",
    session: {
      label: "Session",
      percent: 35,
      displayPercent: 35,
      percentLabel: "35%",
      barMode: "used",
      resetLabel: "2026-01-25 05:00 UTC",
      level: "normal",
    },
    weekly: {
      label: "Weekly",
      percent: 22,
      displayPercent: 22,
      percentLabel: "22%",
      barMode: "used",
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
      displayPercent: 0,
      percentLabel: "0%",
      barMode: "used",
      resetLabel: "Unavailable",
      level: "normal",
    },
    weekly: {
      label: "Weekly",
      percent: 0,
      displayPercent: 0,
      percentLabel: "0%",
      barMode: "used",
      resetLabel: "Unavailable",
      level: "normal",
    },
    lastUpdated: "",
  },
];

const localCodexProvider: NormalizedProviderUsage = {
  provider: "codex",
  displayName: "Codex",
  health: "available",
  session: {
    label: "Daily",
    percent: 42,
    displayPercent: 42,
    percentLabel: "42%",
    barMode: "used",
    resetLabel: "2026-06-24 00:00 UTC",
    level: "normal",
  },
  weekly: {
    label: "Weekly",
    percent: 68,
    displayPercent: 68,
    percentLabel: "68%",
    barMode: "used",
    resetLabel: "2026-06-29 00:00 UTC",
    level: "normal",
  },
  monthly: {
    label: "Monthly",
    percent: 12,
    displayPercent: 12,
    percentLabel: "12%",
    barMode: "used",
    resetLabel: "2026-07-01 00:00 UTC",
    level: "normal",
  },
  localUsage: {
    sourceLabel: "Local Codex data",
    totalTokensLabel: "801.6M tokens",
    estimatedCostLabel: "Estimated cost $542.21",
    historyUsageLabel: "History: 801.6M ($542.21)",
    weeklyUsageLabel: "This week: 12.4M ($8.12)",
    todayUsageLabel: "Today: 1.8M ($1.02)",
    multiplierLabel: "Provider multiplier x1.5",
    modelLabel: "Pricing model gpt-5.5",
    sessionCountLabel: "43 sessions",
    tokenBreakdownLabel: "Input/cached/output/reasoning 798.4M / 739.5M / 3.3M / 1M",
    recentDailyUsage: [
      {
        dateLabel: "06/17",
        tokensLabel: "1.1M",
        costLabel: "$0.72",
        costUsd: 0.72,
        totalTokens: 1_100_000,
        barPercent: 70,
      },
      {
        dateLabel: "06/18",
        tokensLabel: "1.8M",
        costLabel: "$1.02",
        costUsd: 1.02,
        totalTokens: 1_800_000,
        barPercent: 100,
      },
    ],
  },
  lastUpdated: "2026-06-23T02:22:38.325Z",
};

const remainingCodexProvider: NormalizedProviderUsage = {
  ...localCodexProvider,
  session: {
    ...localCodexProvider.session,
    percent: 42,
    displayPercent: 58,
    percentLabel: "Remaining 58%",
    barMode: "remaining",
  },
  weekly: {
    ...localCodexProvider.weekly,
    percent: 68,
    displayPercent: 32,
    percentLabel: "Remaining 32%",
    barMode: "remaining",
  },
  monthly: localCodexProvider.monthly
    ? {
        ...localCodexProvider.monthly,
        percent: 12,
        displayPercent: 88,
        percentLabel: "Remaining 88%",
        barMode: "remaining",
      }
    : undefined,
};

const originalGetContext = HTMLCanvasElement.prototype.getContext;

beforeAll(() => {
  Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
    configurable: true,
    value: vi.fn(() => null),
  });
});

afterAll(() => {
  Object.defineProperty(HTMLCanvasElement.prototype, "getContext", {
    configurable: true,
    value: originalGetContext,
  });
});

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
    await userEvent.click(screen.getByRole("button", { name: "Open expanded usage panel" }));
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

    expect(screen.getByRole("button", { name: "Open compact usage panel" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Hide panel" })).toBeInTheDocument();
    expect(screen.getByText("Claude")).toBeInTheDocument();
    expect(screen.getByText("Codex")).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole("button", { name: "Open compact usage panel" }),
    );
    await userEvent.click(screen.getByRole("button", { name: "Hide panel" }));

    expect(onOpenExpanded).toHaveBeenCalledTimes(1);
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders local Codex usage details in the expanded panel", async () => {
    const rendererModule = await import("./UsagePanel");
    const UsagePanel = Reflect.get(rendererModule, "UsagePanel");

    expect(typeof UsagePanel).toBe("function");

    if (typeof UsagePanel !== "function") {
      return;
    }

    render(
      <UsagePanel
        mode="expanded"
        providers={[localCodexProvider]}
        language="en"
        loading={false}
        lastUpdatedLabel="Updated just now"
      />,
    );

    expect(screen.getByText("Daily")).toBeInTheDocument();
    expect(screen.getByText("Weekly")).toBeInTheDocument();
    expect(screen.getByText("Monthly")).toBeInTheDocument();
    expect(screen.getByText("42%")).toBeInTheDocument();
    expect(screen.getByText("68%")).toBeInTheDocument();
    expect(screen.getByText("12%")).toBeInTheDocument();
    expect(screen.queryByText("Local Codex data")).not.toBeInTheDocument();
  });

  it("renders local Codex history chart in the wide panel", async () => {
    const rendererModule = await import("./UsagePanel");
    const UsagePanel = Reflect.get(rendererModule, "UsagePanel");

    expect(typeof UsagePanel).toBe("function");

    if (typeof UsagePanel !== "function") {
      return;
    }

    const { container } = render(
      <UsagePanel
        mode="compact"
        providers={[localCodexProvider]}
        language="en"
        loading={false}
        lastUpdatedLabel="Updated just now"
      />,
    );

    expect(screen.getByText("History: 801.6M ($542.21)")).toBeInTheDocument();
    expect(screen.getByText("This week: 12.4M ($8.12)")).toBeInTheDocument();
    expect(screen.getByText("Today: 1.8M ($1.02)")).toBeInTheDocument();
    expect(screen.getByRole("img", { name: "Today: 1.8M ($1.02)" })).toBeInTheDocument();
    expect(container.querySelector(".compact-widget__mark")).not.toBeInTheDocument();
    expect(container.querySelector(".usage-history__canvas")).toBeInTheDocument();
    expect(container.querySelector(".usage-history__line")).not.toBeInTheDocument();
  });

  it("renders local Codex usage details in the compact panel", async () => {
    const rendererModule = await import("./UsagePanel");
    const UsagePanel = Reflect.get(rendererModule, "UsagePanel");

    expect(typeof UsagePanel).toBe("function");

    if (typeof UsagePanel !== "function") {
      return;
    }

    render(
      <UsagePanel
        mode="compact"
        providers={[localCodexProvider]}
        language="en"
        loading={false}
        lastUpdatedLabel="Updated just now"
      />,
    );

    expect(screen.getByText("Daily")).toBeInTheDocument();
    expect(screen.getByText("Weekly")).toBeInTheDocument();
    expect(screen.getByText("Monthly")).toBeInTheDocument();
    expect(screen.getByText("42%")).toBeInTheDocument();
    expect(screen.getByText("68%")).toBeInTheDocument();
    expect(screen.getByText("12%")).toBeInTheDocument();
  });

  it("renders Codex remaining usage labels and right-aligned bars when configured", async () => {
    const rendererModule = await import("./UsagePanel");
    const UsagePanel = Reflect.get(rendererModule, "UsagePanel");

    expect(typeof UsagePanel).toBe("function");

    if (typeof UsagePanel !== "function") {
      return;
    }

    const { container } = render(
      <UsagePanel
        mode="expanded"
        providers={[remainingCodexProvider]}
        language="en"
        loading={false}
        lastUpdatedLabel="Updated just now"
      />,
    );

    expect(screen.getByText("Remaining 58%")).toBeInTheDocument();
    expect(screen.getByText("Remaining 32%")).toBeInTheDocument();
    expect(screen.getByText("Remaining 88%")).toBeInTheDocument();
    expect(container.querySelector(".metric-row__bar--remaining")).toBeInTheDocument();
  });
});
