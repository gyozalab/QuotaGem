import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type { UsageDashboardState } from "../shared/dashboard";
import App from "./App";

function createDashboardState(
  overrides: Partial<UsageDashboardState["preferences"]> = {},
): UsageDashboardState {
  return {
    providers: [
      {
        provider: "codex",
        displayName: "Codex",
        health: "available",
        session: {
          label: "Session",
          percent: 10,
          resetLabel: "Soon",
          level: "normal",
        },
        weekly: {
          label: "Weekly",
          percent: 20,
          resetLabel: "Later",
          level: "normal",
        },
        lastUpdated: "2026-03-30T10:00:00.000Z",
      },
    ],
    lastUpdatedLabel: "Updated just now",
    preferences: {
      preferredDisplayMode: "expanded",
      providerVisibility: "both",
      refreshIntervalMinutes: 5,
      warningThreshold: 75,
      dangerThreshold: 90,
      panelScale: 100,
      notificationsEnabled: true,
      notificationLevel: "all",
      language: "en",
      timeDisplay: "utc",
      timeFormat: "24h",
      dateFormat: "iso",
      panelOpacity: 90,
      panelTone: "charcoal",
      launchAtLogin: false,
      ...overrides,
    },
  };
}

describe("App", () => {
  beforeEach(() => {
    const state = createDashboardState();

    window.trayUsageWidget = {
      fetchUsageState: vi.fn().mockResolvedValue(state),
      syncExpandedLayout: vi.fn().mockResolvedValue(undefined),
      openExpandedPanel: vi.fn().mockResolvedValue(undefined),
      openCompactPanel: vi.fn().mockResolvedValue(undefined),
      closePanels: vi.fn().mockResolvedValue(undefined),
      connectClaude: vi.fn().mockResolvedValue(state),
      saveSettings: vi.fn().mockImplementation(async (preferences) =>
        createDashboardState(preferences),
      ),
      onRefreshRequested: vi.fn().mockReturnValue(() => undefined),
    };
  });

  it("lets people toggle launch at login from settings and saves the preference", async () => {
    render(<App />);

    await userEvent.click(
      await screen.findByRole("button", { name: "Open settings" }),
    );

    const launchAtLogin = await screen.findByLabelText(
      "Launch on Windows sign-in",
    );

    expect(launchAtLogin).not.toBeChecked();

    await userEvent.click(launchAtLogin);
    await userEvent.click(screen.getByRole("button", { name: "Save preferences" }));

    await waitFor(() => {
      expect(window.trayUsageWidget.saveSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          launchAtLogin: true,
        }),
      );
    });
  });

  it("lets people customize warning and danger thresholds from settings", async () => {
    render(<App />);

    await userEvent.click(
      await screen.findByRole("button", { name: "Open settings" }),
    );

    const warningThreshold = await screen.findByLabelText("Warning threshold");
    const dangerThreshold = await screen.findByLabelText("Danger threshold");

    await userEvent.clear(warningThreshold);
    await userEvent.type(warningThreshold, "60");
    await userEvent.clear(dangerThreshold);
    await userEvent.type(dangerThreshold, "85");
    await userEvent.click(screen.getByRole("button", { name: "Save preferences" }));

    await waitFor(() => {
      expect(window.trayUsageWidget.saveSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          warningThreshold: 60,
          dangerThreshold: 85,
        }),
      );
    });
  });

  it("lets people disable notifications and switch to danger-only alerts", async () => {
    render(<App />);

    await userEvent.click(
      await screen.findByRole("button", { name: "Open settings" }),
    );

    const notificationsEnabled = await screen.findByLabelText(
      "Enable notifications",
    );
    const notificationLevel = await screen.findByLabelText("Notification mode");

    expect(notificationsEnabled).toBeChecked();

    await userEvent.click(notificationsEnabled);
    await userEvent.selectOptions(notificationLevel, "danger");
    await userEvent.click(screen.getByRole("button", { name: "Save preferences" }));

    await waitFor(() => {
      expect(window.trayUsageWidget.saveSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          notificationsEnabled: false,
          notificationLevel: "danger",
        }),
      );
    });
  });

  it("lets people adjust panel scale with a slider", async () => {
    render(<App />);

    await userEvent.click(
      await screen.findByRole("button", { name: "Open settings" }),
    );

    const panelScale = await screen.findByRole("slider", {
      name: "Panel scale: 100%",
    });

    fireEvent.change(panelScale, { target: { value: "4" } });
    await userEvent.click(screen.getByRole("button", { name: "Save preferences" }));

    await waitFor(() => {
      expect(window.trayUsageWidget.saveSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          panelScale: 150,
        }),
      );
    });
  });

  it("lets people choose one of the richer panel themes", async () => {
    render(<App />);

    await userEvent.click(
      await screen.findByRole("button", { name: "Open settings" }),
    );

    const panelTone = await screen.findByLabelText("Panel background color");

    await userEvent.selectOptions(panelTone, "linen");
    await userEvent.click(screen.getByRole("button", { name: "Save preferences" }));

    await waitFor(() => {
        expect(window.trayUsageWidget.saveSettings).toHaveBeenCalledWith(
          expect.objectContaining({
          panelTone: "linen",
          }),
        );
      });
  });

  it("lets people choose a date format from settings", async () => {
    render(<App />);

    await userEvent.click(
      await screen.findByRole("button", { name: "Open settings" }),
    );

    const dateFormat = await screen.findByLabelText("Date format");

    await userEvent.selectOptions(dateFormat, "dmy");
    await userEvent.click(screen.getByRole("button", { name: "Save preferences" }));

    await waitFor(() => {
      expect(window.trayUsageWidget.saveSettings).toHaveBeenCalledWith(
        expect.objectContaining({
          dateFormat: "dmy",
        }),
      );
    });
  });

  it("derives control opacity tokens from the panel transparency preference", async () => {
    const state = createDashboardState({
      panelOpacity: 76,
      panelTone: "linen",
    });

    window.trayUsageWidget.fetchUsageState = vi.fn().mockResolvedValue(state);

    const { container } = render(<App />);

    await screen.findByText("Updated just now");

    const root = container.firstElementChild as HTMLElement;

    expect(root.style.getPropertyValue("--panel-control-alpha")).toBe("0.62");
    expect(root.style.getPropertyValue("--panel-control-border-alpha")).toBe("0.24");
    expect(root.style.getPropertyValue("--panel-scrollbar-thumb-alpha")).toBe("0.68");
  });

  it("does not start a renderer-side polling timer", async () => {
    const setIntervalSpy = vi.spyOn(window, "setInterval");

    render(<App />);

    await screen.findByText("Updated just now");

    expect(setIntervalSpy).not.toHaveBeenCalledWith(
      expect.any(Function),
      300_000,
    );
  });

  it("syncs expanded layout using the measured panel height", async () => {
    const rectSpy = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockImplementation(function (this: HTMLElement) {
        if (this.className.includes("expanded-panel")) {
          return {
            x: 0,
            y: 0,
            top: 0,
            left: 0,
            right: 364,
            bottom: 302,
            width: 364,
            height: 302,
            toJSON: () => ({}),
          } as DOMRect;
        }

        return {
          x: 0,
          y: 0,
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          width: 0,
          height: 0,
          toJSON: () => ({}),
        } as DOMRect;
      });

    render(<App />);

    await waitFor(() => {
      expect(window.trayUsageWidget.syncExpandedLayout).toHaveBeenCalledWith({
        contentHeight: 330,
        settingsOpen: false,
      });
    });

    rectSpy.mockRestore();
  });

  it("tells the main process to keep the full height while settings are open", async () => {
    const rectSpy = vi
      .spyOn(HTMLElement.prototype, "getBoundingClientRect")
      .mockReturnValue({
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: 364,
        bottom: 302,
        width: 364,
        height: 302,
        toJSON: () => ({}),
      } as DOMRect);

    render(<App />);

    await userEvent.click(
      await screen.findByRole("button", { name: "Open settings" }),
    );

    await waitFor(() => {
      expect(window.trayUsageWidget.syncExpandedLayout).toHaveBeenCalledWith({
        contentHeight: 330,
        settingsOpen: true,
      });
    });

    rectSpy.mockRestore();
  });

  it("removes the underlying usage panel while settings are open", async () => {
    render(<App />);

    await screen.findByText("10%");

    await userEvent.click(
      await screen.findByRole("button", { name: "Open settings" }),
    );

    expect(screen.queryByText("10%")).not.toBeInTheDocument();
  });

  it("hides manual Claude credential fields from settings", async () => {
    render(<App />);

    await userEvent.click(
      await screen.findByRole("button", { name: "Open settings" }),
    );

    expect(
      screen.queryByText("Manual Claude troubleshooting"),
    ).not.toBeInTheDocument();
    expect(screen.queryByPlaceholderText("sk-ant-sid01-...")).not.toBeInTheDocument();
  });
});
