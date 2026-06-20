import { createServer, type Server } from "node:http";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  discoverAntigravityServers,
  postAntigravityRpc,
  readAntigravitySnapshot,
} from "./antigravity-service";

const servers: Server[] = [];

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise<void>((resolve) => server.close(() => resolve())),
    ),
  );
});

async function listen(
  handler: Parameters<typeof createServer>[0],
): Promise<number> {
  const server = createServer(handler);
  servers.push(server);
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  if (!address || typeof address === "string") {
    throw new Error("Expected a TCP listener");
  }
  return address.port;
}

describe("Antigravity server discovery", () => {
  it("discovers all server ports with one PowerShell invocation", async () => {
    const runPowerShell = vi.fn().mockResolvedValue(
      JSON.stringify([
        {
          processId: 101,
          commandLine: "language_server.exe --csrf_token first-token",
          ports: [4101, 4102],
        },
        {
          processId: 202,
          commandLine: "language_server.exe --csrf_token second-token",
          ports: 4201,
        },
      ]),
    );

    await expect(
      discoverAntigravityServers(Date.now() + 10_000, runPowerShell),
    ).resolves.toEqual([
      { csrf: "first-token", ports: [4101, 4102] },
      { csrf: "second-token", ports: [4201] },
    ]);
    expect(runPowerShell).toHaveBeenCalledTimes(1);
  });

  it("returns no candidates for malformed or sensitive-looking discovery output", async () => {
    const runPowerShell = vi.fn().mockResolvedValue("not-json csrf@example.com");

    await expect(
      discoverAntigravityServers(Date.now() + 10_000, runPowerShell),
    ).resolves.toEqual([]);
  });

  it("rejects non-2xx, malformed, oversized and timed-out RPC responses", async () => {
    const redirectPort = await listen((_request, response) => {
      response.writeHead(302, { Location: "http://example.com" });
      response.end();
    });
    const malformedPort = await listen((_request, response) => {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end("not-json");
    });
    const oversizedPort = await listen((_request, response) => {
      response.writeHead(200, { "Content-Type": "application/json" });
      response.end(JSON.stringify({ payload: "x".repeat(300_000) }));
    });
    const hangingPort = await listen(() => undefined);

    await expect(
      postAntigravityRpc(redirectPort, "http", "secret", "GetUserStatus", 100),
    ).resolves.toBeNull();
    await expect(
      postAntigravityRpc(malformedPort, "http", "secret", "GetUserStatus", 100),
    ).resolves.toBeNull();
    await expect(
      postAntigravityRpc(oversizedPort, "http", "secret", "GetUserStatus", 100),
    ).resolves.toBeNull();
    await expect(
      postAntigravityRpc(hangingPort, "http", "secret", "GetUserStatus", 30),
    ).resolves.toBeNull();
  });

  it("skips logged-out candidates and returns the first valid quota snapshot", async () => {
    const rpc = vi
      .fn()
      .mockResolvedValueOnce({ userStatus: {} })
      .mockResolvedValueOnce({ userStatus: { planStatus: "pro" } })
      .mockResolvedValueOnce({
        response: {
          groups: [
            {
              displayName: "Gemini Models",
              buckets: [
                { window: "5h", remainingFraction: 0.75, resetTime: "s" },
                { window: "weekly", remainingFraction: 0.5, resetTime: "w" },
              ],
            },
          ],
        },
      });

    const snapshot = await readAntigravitySnapshot({
      discover: async () => [
        { csrf: "logged-out", ports: [4101] },
        { csrf: "logged-in", ports: [4201] },
      ],
      rpc,
    });

    expect(snapshot).toMatchObject({
      provider: "antigravity",
      health: "available",
      sessionPercent: 25,
      weeklyPercent: 50,
    });
    expect(rpc).toHaveBeenCalledTimes(3);
  });

  it("returns null without logging csrf or account data when RPC data is invalid", async () => {
    const log = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const error = vi.spyOn(console, "error").mockImplementation(() => undefined);

    await expect(
      readAntigravitySnapshot({
        discover: async () => [{ csrf: "private-token", ports: [4101] }],
        rpc: vi
          .fn()
          .mockResolvedValueOnce({
            userStatus: { planStatus: "pro", email: "private@example.com" },
          })
          .mockResolvedValueOnce({ response: {} }),
      }),
    ).resolves.toBeNull();

    expect(log).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it.skipIf(process.env.ANTIGRAVITY_LIVE_TEST !== "1")(
    "reads quota from a running logged-in Antigravity IDE",
    async () => {
      const snapshot = await readAntigravitySnapshot();

      expect(snapshot).toMatchObject({
        provider: "antigravity",
        health: "available",
      });
      expect(snapshot?.groups).toHaveLength(2);
    },
    10_000,
  );
});
