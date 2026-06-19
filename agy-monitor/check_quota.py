#!/usr/bin/env python3
"""Antigravity quota monitor — reads from local gRPC server via CDP and writes to .jsonl."""

import json
import asyncio
import sys
from datetime import datetime, timezone, timedelta
from pathlib import Path

try:
    import websockets
except ImportError:
    print("websockets not installed — run: pip install websockets", file=sys.stderr)
    sys.exit(1)

DEVTOOLS_PORT = 50991
OUTPUT_FILE = Path(__file__).parent / "agy-usage.jsonl"


async def fetch_user_status():
    import urllib.request
    try:
        targets_raw = urllib.request.urlopen(f"http://localhost:{DEVTOOLS_PORT}/json", timeout=3).read()
    except Exception as e:
        raise RuntimeError(f"Antigravity DevTools not reachable: {e}")

    targets = json.loads(targets_raw)
    ws_url = next((t["webSocketDebuggerUrl"] for t in targets if t.get("type") == "page"), None)
    if not ws_url:
        raise RuntimeError("No Antigravity page target found")

    async with websockets.connect(ws_url, max_size=10_000_000, open_timeout=5) as ws:
        await ws.send(json.dumps({
            "id": 1,
            "method": "Network.enable",
            "params": {"maxResourceBufferSize": 100_000_000, "maxTotalBufferSize": 100_000_000},
        }))
        await ws.recv()

        # Trigger a fresh RetrieveUserQuotaSummary by executing JS fetch from the page context
        # (same-origin, page already has auth cookies/session)
        csrf_token = None
        await ws.send(json.dumps({
            "id": 2,
            "method": "Runtime.evaluate",
            "params": {"expression": "window.__APP_CONFIG__?.csrfToken", "returnByValue": True},
        }))
        r = json.loads(await ws.recv())
        csrf_token = r.get("result", {}).get("result", {}).get("value")

        if not csrf_token:
            raise RuntimeError("Could not read CSRF token from Antigravity page")

        # Call RetrieveUserQuotaSummary from the page context (same-origin, no CORS issue)
        script = """
(async () => {
  try {
    const resp = await fetch(
      'https://127.0.0.1:50992/exa.language_server_pb.LanguageServerService/RetrieveUserQuotaSummary',
      {
        method: 'POST',
        credentials: 'include',
        headers: {
          'content-type': 'application/grpc-web+json',
          'x-grpc-web': '1',
          'x-codeium-csrf-token': window.__APP_CONFIG__?.csrfToken || '',
          'x-user-agent': 'CONNECT_ES_USER_AGENT',
          'Accept': 'application/grpc-web+json',
        },
        body: '\\x00\\x00\\x00\\x00\\x02{}',
      }
    );
    const text = await resp.text();
    const h = {};
    resp.headers.forEach((v, k) => { h[k] = v; });
    return JSON.stringify({ status: resp.status, headers: h, body: text });
  } catch (e) {
    return JSON.stringify({ error: String(e) });
  }
})()
"""
        await ws.send(json.dumps({
            "id": 3,
            "method": "Runtime.evaluate",
            "params": {"expression": script, "returnByValue": True, "awaitPromise": True},
        }))

        # Wait for the JS result
        result_val = None
        deadline = asyncio.get_event_loop().time() + 10
        while asyncio.get_event_loop().time() < deadline:
            try:
                msg = json.loads(await asyncio.wait_for(ws.recv(), timeout=1.0))
                if msg.get("id") == 3:
                    result_val = msg.get("result", {}).get("result", {}).get("value")
                    break
            except asyncio.TimeoutError:
                pass

        if not result_val:
            # Fallback: reload page and capture the natural GetUserStatus/RetrieveUserQuotaSummary call
            return await _capture_via_reload(ws)

        parsed = json.loads(result_val)
        if "error" in parsed:
            # Fallback: reload page and capture the natural GetUserStatus/RetrieveUserQuotaSummary call
            return await _capture_via_reload(ws)

        body = parsed.get("body", "")
        return _parse_user_status_body(body)


async def _capture_via_reload(ws):
    """Reload page and capture GetUserStatus or RetrieveUserQuotaSummary response naturally."""
    await ws.send(json.dumps({"id": 10, "method": "Page.reload"}))
    await ws.recv()

    req_map = {}
    deadline = asyncio.get_event_loop().time() + 10
    while asyncio.get_event_loop().time() < deadline:
        try:
            msg = json.loads(await asyncio.wait_for(ws.recv(), timeout=0.5))
            method = msg.get("method", "")

            if method == "Network.requestWillBeSent":
                url = msg["params"]["request"]["url"]
                if "RetrieveUserQuotaSummary" in url or "GetUserStatus" in url:
                    req_map[msg["params"]["requestId"]] = True

            elif method == "Network.loadingFinished":
                req_id = msg["params"]["requestId"]
                if req_id in req_map:
                    await ws.send(json.dumps({
                        "id": 99,
                        "method": "Network.getResponseBody",
                        "params": {"requestId": req_id},
                    }))
                    while True:
                        rb = json.loads(await asyncio.wait_for(ws.recv(), timeout=3))
                        if rb.get("id") == 99:
                            body = rb.get("result", {}).get("body", "")
                            return _parse_user_status_body(body)
        except asyncio.TimeoutError:
            pass

    raise RuntimeError("Timed out waiting for GetUserStatus or RetrieveUserQuotaSummary response")


def _parse_user_status_body(body: str) -> dict:
    """Extract quota data from gRPC-Web+json response body."""
    brace_start = body.find("{")
    if brace_start < 0:
        raise ValueError(f"No JSON in body: {repr(body[:100])}")

    depth = 0
    json_end = -1
    for i in range(brace_start, len(body)):
        if body[i] == "{":
            depth += 1
        elif body[i] == "}":
            depth -= 1
            if depth == 0:
                json_end = i + 1
                break

    data = json.loads(body[brace_start:json_end])

    # Format 1: RetrieveUserQuotaSummary response
    response_data = data.get("response", {})
    if "groups" in response_data:
        gemini_weekly = None
        gemini_5h = None
        third_party_weekly = None
        third_party_5h = None
        for group in response_data.get("groups", []):
            name = group.get("displayName")
            if name == "Gemini Models":
                for bucket in group.get("buckets", []):
                    if bucket.get("window") == "weekly":
                        gemini_weekly = {
                            "remaining_fraction": bucket.get("remainingFraction"),
                            "reset_time": bucket.get("resetTime")
                        }
                    elif bucket.get("window") == "5h":
                        gemini_5h = {
                            "remaining_fraction": bucket.get("remainingFraction"),
                            "reset_time": bucket.get("resetTime")
                        }
            elif name == "Claude and GPT models":
                for bucket in group.get("buckets", []):
                    if bucket.get("window") == "weekly":
                        third_party_weekly = {
                            "remaining_fraction": bucket.get("remainingFraction"),
                            "reset_time": bucket.get("resetTime")
                        }
                    elif bucket.get("window") == "5h":
                        third_party_5h = {
                            "remaining_fraction": bucket.get("remainingFraction"),
                            "reset_time": bucket.get("resetTime")
                        }
        return {
            "gemini_5h": gemini_5h,
            "gemini_weekly": gemini_weekly,
            "third_party_5h": third_party_5h,
            "third_party_weekly": third_party_weekly,
            # backwards compatibility:
            "five_hour": gemini_5h,
            "weekly": gemini_weekly
        }

    # Format 2: GetUserStatus response (fallback)
    us = data.get("userStatus", {})
    models = us.get("cascadeModelConfigData", {}).get("clientModelConfigs", [])

    gemini_quota = None
    for m in models:
        label = m.get("label", "")
        if "Gemini" in label and m.get("quotaInfo"):
            gemini_quota = m["quotaInfo"]
            break

    if gemini_quota:
        q = {
            "remaining_fraction": gemini_quota.get("remainingFraction"),
            "reset_time": gemini_quota.get("resetTime")
        }
        return {
            "gemini_5h": q,
            "gemini_weekly": None,
            "third_party_5h": None,
            "third_party_weekly": None,
            # backwards compatibility:
            "five_hour": q,
            "weekly": None
        }

    return {
        "gemini_5h": None,
        "gemini_weekly": None,
        "third_party_5h": None,
        "third_party_weekly": None,
        "five_hour": None,
        "weekly": None
    }


def main():
    try:
        result = asyncio.run(fetch_user_status())
    except Exception as e:
        print(f"Error: {e}", file=sys.stderr)
        sys.exit(1)

    taipei_tz = timezone(timedelta(hours=8))
    now_taipei = datetime.now(taipei_tz)
    timestamp = now_taipei.isoformat()

    gemini_5h = result.get("gemini_5h") or {}
    gemini_weekly = result.get("gemini_weekly") or {}
    third_party_5h = result.get("third_party_5h") or {}
    third_party_weekly = result.get("third_party_weekly") or {}

    gemini_5h_fraction = gemini_5h.get("remaining_fraction", 1.0)
    gemini_weekly_fraction = gemini_weekly.get("remaining_fraction")
    third_party_5h_fraction = third_party_5h.get("remaining_fraction")
    third_party_weekly_fraction = third_party_weekly.get("remaining_fraction")

    record = {
        "timestamp": timestamp,
        "provider": "gemini",
        "usage": {
            "five_hour": {
                "remaining_fraction": gemini_5h_fraction,
                "reset_time": gemini_5h.get("reset_time"),
            },
            "gemini_5h": {
                "remaining_fraction": gemini_5h_fraction,
                "reset_time": gemini_5h.get("reset_time"),
            }
        },
    }

    if gemini_weekly_fraction is not None:
        record["usage"]["weekly"] = {
            "remaining_fraction": gemini_weekly_fraction,
            "reset_time": gemini_weekly.get("reset_time"),
        }
        record["usage"]["gemini_weekly"] = {
            "remaining_fraction": gemini_weekly_fraction,
            "reset_time": gemini_weekly.get("reset_time"),
        }

    if third_party_5h_fraction is not None:
        record["usage"]["third_party_5h"] = {
            "remaining_fraction": third_party_5h_fraction,
            "reset_time": third_party_5h.get("reset_time"),
        }

    if third_party_weekly_fraction is not None:
        record["usage"]["third_party_weekly"] = {
            "remaining_fraction": third_party_weekly_fraction,
            "reset_time": third_party_weekly.get("reset_time"),
        }

    with open(OUTPUT_FILE, "a") as f:
        f.write(json.dumps(record, ensure_ascii=False) + "\n")

    used_gemini_5h = round((1 - gemini_5h_fraction) * 100, 1)
    print(f"⏱  {timestamp}")
    print(f"Gemini 5-hour quota: {used_gemini_5h}% used (remaining: {gemini_5h_fraction:.4f})")
    if gemini_5h.get("reset_time"):
        print(f"Resets (Gemini 5h) at: {gemini_5h.get('reset_time')}")
    if gemini_weekly_fraction is not None:
        used_gemini_weekly = round((1 - gemini_weekly_fraction) * 100, 1)
        print(f"Gemini weekly quota: {used_gemini_weekly}% used (remaining: {gemini_weekly_fraction:.4f})")
        if gemini_weekly.get("reset_time"):
            print(f"Resets (Gemini weekly) at: {gemini_weekly.get('reset_time')}")
            
    if third_party_5h_fraction is not None:
        used_3p_5h = round((1 - third_party_5h_fraction) * 100, 1)
        print(f"Third-Party 5-hour quota: {used_3p_5h}% used (remaining: {third_party_5h_fraction:.4f})")
        if third_party_5h.get("reset_time"):
            print(f"Resets (3P 5h) at: {third_party_5h.get('reset_time')}")
    if third_party_weekly_fraction is not None:
        used_3p_weekly = round((1 - third_party_weekly_fraction) * 100, 1)
        print(f"Third-Party weekly quota: {used_3p_weekly}% used (remaining: {third_party_weekly_fraction:.4f})")
        if third_party_weekly.get("reset_time"):
            print(f"Resets (3P weekly) at: {third_party_weekly.get('reset_time')}")
            
    print(f"\n📁 Logged to {OUTPUT_FILE}")


if __name__ == "__main__":
    main()
