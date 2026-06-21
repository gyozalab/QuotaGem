import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { vi } from "vitest";

import { stripYear } from "./UsagePanel";
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

const antigravityProvider: NormalizedProviderUsage = {
  provider: "antigravity",
  displayName: "Antigravity",
  health: "available",
  session: {
    label: "5 hours",
    percent: 40,
    resetLabel: "Soon",
    level: "normal",
  },
  weekly: {
    label: "Weekly",
    percent: 30,
    resetLabel: "Later",
    level: "normal",
  },
  groups: [
    {
      label: "Gemini Models",
      session: { label: "5 hours", percent: 10, resetLabel: "Soon", level: "normal" },
      weekly: { label: "Weekly", percent: 30, resetLabel: "Later", level: "normal" },
    },
    {
      label: "Claude and GPT models",
      session: { label: "5 hours", percent: 40, resetLabel: "Soon", level: "normal" },
      weekly: { label: "Weekly", percent: 20, resetLabel: "Later", level: "normal" },
    },
  ],
  lastUpdated: "2026-06-19T20:00:00.000Z",
};

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
    expect(screen.getAllByText("5h")).toHaveLength(2);
    expect(screen.getAllByText("Weekly")).toHaveLength(2);
    expect(screen.getAllByText(/Unavailable/).length).toBeGreaterThan(0);
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

  it("uses full expanded labels and two half-capacity model segments per compact track", async () => {
    const rendererModule = await import("./UsagePanel");
    const UsagePanel = Reflect.get(rendererModule, "UsagePanel");

    expect(typeof UsagePanel).toBe("function");
    if (typeof UsagePanel !== "function") {
      return;
    }

    const expanded = render(
      <UsagePanel
        mode="expanded"
        providers={[antigravityProvider]}
        language="en"
        loading={false}
        lastUpdatedLabel="Updated just now"
      />,
    );

    expect(screen.getByText("Gemini")).toBeInTheDocument();
    expect(screen.queryByText("Gemini Models")).not.toBeInTheDocument();
    expect(screen.getByText("Claude and GPT")).toBeInTheDocument();
    expect(screen.queryByText("Claude and GPT models")).not.toBeInTheDocument();
    expect(
      expanded.container.querySelector("img.provider-icon--antigravity"),
    ).toHaveAttribute("src", "./antigravity-icon.png");
    expanded.unmount();

    const compact = render(
      <UsagePanel
        mode="compact"
        providers={[...providers, antigravityProvider]}
        language="en"
        loading={false}
        lastUpdatedLabel="Updated just now"
      />,
    );

    expect(
      compact.container.querySelector(".compact-widget__rings--three"),
    ).toBeInTheDocument();
    expect(compact.container.querySelectorAll(".compact-provider")).toHaveLength(3);

    // Compact rings carry no per-window or per-group text labels.
    expect(screen.queryByText("Gemini")).not.toBeInTheDocument();
    expect(screen.queryByText("Others")).not.toBeInTheDocument();
    expect(screen.queryByText("5 hours")).not.toBeInTheDocument();
    expect(screen.queryByText("Weekly")).not.toBeInTheDocument();

    // Claude ring surfaces the tighter of session (35) / weekly (22).
    expect(screen.getByText("35%")).toBeInTheDocument();

    // Antigravity stays honest: one ring split into two halves, each the
    // tighter window of its group (Gemini max(10,30)=30, Others max(40,20)=40),
    // and the spoken names come from the real group labels, not hardcoded.
    const splitRing = screen.getByLabelText("Gemini 30%, Claude and GPT 40%");
    const splitFills = splitRing.querySelectorAll(".compact-ring__fill");
    expect(splitFills).toHaveLength(2);
    // Gemini = left semicircle (sweep 0), Others = right (sweep 1): guards a swap.
    expect(splitFills[0].getAttribute("d")).toContain("0 0 0");
    expect(splitFills[1].getAttribute("d")).toContain("0 0 1");
    // Arc fill length reflects percent over the half-circumference (62.832).
    expect(
      parseFloat(splitFills[0].getAttribute("stroke-dasharray")!.split(" ")[0]),
    ).toBeCloseTo((62.832 * 30) / 100, 1);
    expect(
      parseFloat(splitFills[1].getAttribute("stroke-dasharray")!.split(" ")[0]),
    ).toBeCloseTo((62.832 * 40) / 100, 1);

    // Claude full ring: dasharray reflects 35% over the full circumference (125.664).
    const claudeFill = screen
      .getByText("Claude")
      .closest("article")
      ?.querySelector(".compact-ring__fill");
    expect(
      parseFloat(claudeFill?.getAttribute("stroke-dasharray")?.split(" ")[0] ?? "0"),
    ).toBeCloseTo((125.664 * 35) / 100, 1);

    // Unavailable provider (codex) shows the dash, the off state, and no fill arc.
    const codexCard = screen.getByText("Codex").closest("article");
    expect(codexCard?.querySelector(".compact-ring--off")).toBeInTheDocument();
    expect(codexCard).toHaveTextContent("—");
    expect(codexCard?.querySelectorAll(".compact-ring__fill")).toHaveLength(0);

    const antigravityCard = screen.getByText("Antigravity").closest("article");
    expect(antigravityCard).not.toBeNull();
    expect(antigravityCard).toHaveTextContent("30");
    expect(antigravityCard).toHaveTextContent("40");
    expect(antigravityCard?.querySelectorAll(".compact-reset-chip")).toHaveLength(0);
    expect(antigravityCard).not.toHaveTextContent("Soon");
    expect(antigravityCard).not.toHaveTextContent("Later");
  });

  it("renders a split ring as off when Antigravity is unavailable", async () => {
    const rendererModule = await import("./UsagePanel");
    const UsagePanel = Reflect.get(rendererModule, "UsagePanel");

    if (typeof UsagePanel !== "function") {
      return;
    }

    const unavailableAntigravity: NormalizedProviderUsage = {
      ...antigravityProvider,
      health: "unavailable",
    };

    render(
      <UsagePanel
        mode="compact"
        providers={[unavailableAntigravity]}
        language="en"
        loading={false}
        lastUpdatedLabel="Updated just now"
      />,
    );

    const splitRing = screen.getByLabelText("Antigravity Unavailable");
    expect(splitRing).toHaveClass("compact-ring--off");
    expect(splitRing.querySelectorAll(".compact-ring__fill")).toHaveLength(0);

    const card = screen.getByText("Antigravity").closest("article");
    expect(card).toHaveTextContent("—");
    expect(card).not.toHaveTextContent("30");
    expect(card).not.toHaveTextContent("40");
  });
});

describe("stripYear", () => {
  it("drops the year from iso/mdy/dmy formats and leaves non-year text intact", () => {
    expect(stripYear("2026-01-25 05:00 UTC")).toBe("01-25 05:00 UTC");
    expect(stripYear("01/25/2026 05:00 PM UTC")).toBe("01/25 05:00 PM UTC");
    expect(stripYear("25/01/2026 05:00")).toBe("25/01 05:00");
    expect(stripYear("Unavailable")).toBe("Unavailable");
    expect(stripYear("Soon")).toBe("Soon");
  });
});
