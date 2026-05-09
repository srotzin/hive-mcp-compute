<!-- HIVE_BANNER_V1 -->
<p align="center">
  <a href="https://hive-mcp-gateway.onrender.com/compute/health">
    <img src="https://hive-mcp-gateway.onrender.com/compute/og.svg" alt="HiveCompute · OpenAI-Compatible Inference Broker MCP" width="100%"/>
  </a>
</p>

<h1 align="center">hive-mcp-compute</h1>

<p align="center"><strong>OpenAI-compatible inference broker. Pay per token in USDC on Base L2.</strong></p>

<p align="center">
  <a href="https://smithery.ai/server/hivecivilization"><img alt="Smithery" src="https://img.shields.io/badge/Smithery-hivecivilization-C08D23?style=flat-square"/></a>
  <a href="https://glama.ai/mcp/servers"><img alt="Glama" src="https://img.shields.io/badge/Glama-pending-C08D23?style=flat-square"/></a>
  <a href="https://hive-mcp-gateway.onrender.com/compute/health"><img alt="Live" src="https://img.shields.io/badge/gateway-live-C08D23?style=flat-square"/></a>
  <a href="https://github.com/srotzin/hive-mcp-compute/releases"><img alt="Release" src="https://img.shields.io/github/v/release/srotzin/hive-mcp-compute?style=flat-square&color=C08D23"/></a>
  <a href="LICENSE"><img alt="License" src="https://img.shields.io/badge/license-MIT-C08D23?style=flat-square"/></a>
</p>

<p align="center">
  <code>https://hive-mcp-gateway.onrender.com/compute/mcp</code>
</p>

---

# HiveCompute

**OpenAI-compatible inference broker. Pay per token in USDC on Base L2.**

MCP server for HiveCompute — OpenAI-compatible inference router for the Hive agent economy. Chat completions, embeddings, and model listings. Hive routes to the cheapest qualifying model. Billed per token in USDC on Base L2. Real rails.

## What this is

`hive-mcp-compute` is a Model Context Protocol (MCP) server that exposes the HiveCompute platform on the Hive Civilization to any MCP-compatible client (Claude Desktop, Cursor, Manus, etc.). The server proxies to the live production gateway at `https://hive-mcp-gateway.onrender.com`.

- **Protocol:** MCP 2024-11-05 over Streamable-HTTP / JSON-RPC 2.0
- **x402 micropayments:** every paid call produces a real on-chain settlement
- **Rails:** USDC on Base L2 — real rails, no mocks
- **Author:** Steve Rotzin · Hive Civilization · brand gold `#C08D23`

## Endpoints

| Path | Purpose |
|------|---------|
| `POST /mcp` | JSON-RPC 2.0 / MCP 2024-11-05 |
| `GET  /` | HTML landing with comprehensive meta tags + JSON-LD |
| `GET  /health` | Health + telemetry |
| `GET  /.well-known/mcp.json` | MCP discovery descriptor |
| `GET  /.well-known/security.txt` | RFC 9116 security contact |
| `GET  /robots.txt` | Allow-all crawl policy |
| `GET  /sitemap.xml` | Crawler sitemap |
| `GET  /og.svg` | 1200×630 Hive-gold OG image |
| `GET  /seo.json` | JSON-LD structured data (SoftwareApplication) |

## License

MIT. © Steve Rotzin / Hive Civilization. Brand gold `#C08D23` (Pantone 1245 C). Never `#f5c518`.

## Hive Civilization Directory

Part of the Hive Civilization — agent-native financial infrastructure.

- Endpoint Directory: https://thehiveryiq.com
- Live Leaderboard: https://hive-a2amev.onrender.com/leaderboard
- Revenue Dashboard: https://hivemine-dashboard.onrender.com
- Other MCP Servers: https://github.com/srotzin?tab=repositories&q=hive-mcp

Brand: #C08D23
<!-- /hive-footer -->

---

## Agent-Callable

**hive-mcp-compute** is fully agent-callable — no accounts, no API keys, no human approval.

| Property | Value |
|----------|-------|
| Discovery URL | `https://hivemorph.onrender.com/.well-known/agent-card.json` |
| MCP endpoint | `https://hive-mcp-gateway.onrender.com/mcp` (JSON-RPC 2.0 / MCP 2024-11-05) |
| Pricing | Pay-per-token in USDC on Base L2 |
| Payment | x402 USDC on Base 8453 |
| Treasury | `0x15184Bf50B3d3F52b60434f8942b7D52F2eB436E` |
| DID | `did:hivemorph:w2loren:0x6b11b1bcaf253c` |
| Hive site | [thehiveryiq.com](https://thehiveryiq.com) |

### Sample request (chat completion via MCP)

```json
// JSON-RPC 2.0 to https://hive-mcp-gateway.onrender.com/mcp
{
  "jsonrpc": "2.0",
  "method": "tools/call",
  "params": {
    "name": "hive_compute_chat",
    "arguments": {
      "model": "auto",
      "messages": [{"role": "user", "content": "Hello, Hive!"}],
      "agent_did": "did:example:my-agent",
      "x402_token": "<token_from_quote_flow>"
    }
  },
  "id": 1
}
```

Get a quote first at `POST https://hivemorph.onrender.com/v1/x402/quote`, pay USDC on Base 8453, use the access token.
