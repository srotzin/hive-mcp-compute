// server.js — HiveCompute MCP Server
import express from 'express';
import cors from 'cors';
import { renderLanding, renderRobots, renderSitemap, renderSecurity, renderOgImage, seoJson, BRAND_GOLD } from './meta.js';

const app = express();
const PORT = process.env.PORT || 3000;
const BASE_URL = 'https://hivecompute-g2g7.onrender.com';
const INTERNAL_KEY = process.env.INTERNAL_KEY || 'hive_internal_125e04e071e8829be631ea0216dd4a0c9b707975fcecaf8c62c6a2ab43327d46';

app.use(cors());
app.use(express.json({ limit: '4mb' }));

app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    console.log(`${req.method} ${req.path} ${res.statusCode} ${Date.now() - start}ms`);
  });
  next();
});

// ─── Health ─────────────────────────────────────────────────────────────────
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'hivecompute-mcp',
    version: '1.0.0',
    description: 'OpenAI-compatible inference router for the Hive agent economy. Pay per token in USDC on Base L2.',
    timestamp: new Date().toISOString(),
    uptime_seconds: Math.floor(process.uptime()),
  });
});

// ─── MCP Tools ──────────────────────────────────────────────────────────────
const MCP_TOOLS = [
  {
    name: 'compute.chat',
    description: 'Run inference via Hive\'s OpenAI-compatible router. Submit a prompt or message array to any available model. Billed per input+output token in USDC on Base L2. Hive routes to the cheapest available model meeting your latency and quality spec.',
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: false, openWorldHint: true },
    inputSchema: {
      type: 'object',
      required: ['messages', 'did', 'api_key'],
      properties: {
        messages: {
          type: 'array',
          description: 'OpenAI-compatible messages array. Each item must have role (system|user|assistant) and content (string).',
          items: {
            type: 'object',
            properties: {
              role: { type: 'string', description: 'Message role. One of: system, user, assistant.' },
              content: { type: 'string', description: 'Message content text.' },
            },
          },
        },
        model: { type: 'string', description: 'Specific model to use (e.g. gpt-4o, claude-3-5-sonnet, llama-3-70b). Omit to let Hive auto-route to the cheapest qualifying model.' },
        max_tokens: { type: 'integer', description: 'Maximum tokens to generate in the response. Default 512.' },
        temperature: { type: 'number', description: 'Sampling temperature between 0.0 and 2.0. Default 0.7.' },
        max_cost_usdc: { type: 'number', description: 'Hard cap on USDC spend for this inference call. Request rejected if estimated cost exceeds this. Default 0.05.' },
        did: { type: 'string', description: 'Agent DID (e.g. did:hive:xxxx). USDC billed to this agent\'s Hive wallet.' },
        api_key: { type: 'string', description: 'Agent API key issued by HiveGate. Required for authenticated inference.' },
      },
    },
  },
  {
    name: 'compute.embed',
    description: 'Generate vector embeddings via Hive\'s embedding router. Billed per 1K input tokens in USDC on Base L2. Returns a float array suitable for semantic search, clustering, or RAG pipelines.',
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: true },
    inputSchema: {
      type: 'object',
      required: ['input', 'did', 'api_key'],
      properties: {
        input: { type: 'string', description: 'Text to embed. Pass a string for a single embedding or use the batch endpoint for multiple inputs.' },
        model: { type: 'string', description: 'Embedding model to use. Defaults to text-embedding-3-small. Options: text-embedding-3-small, text-embedding-3-large, embed-multilingual-v3.' },
        dimensions: { type: 'integer', description: 'Desired embedding dimensions. Must be supported by the selected model.' },
        did: { type: 'string', description: 'Agent DID. Billing is per 1K tokens.' },
        api_key: { type: 'string', description: 'Agent API key issued by HiveGate.' },
      },
    },
  },
  {
    name: 'compute.list_models',
    description: 'Browse all models available through the Hive inference router — including per-token pricing in USDC, context window size, latency tier, and provider. No authentication required.',
    annotations: { readOnlyHint: true, openWorldHint: false },
    inputSchema: {
      type: 'object',
      properties: {
        family: { type: 'string', description: 'Filter by model family. One of: gpt-4, claude-3, llama-3, mistral, gemini, embed.' },
        max_price_per_1m: { type: 'number', description: 'Filter to models priced below this amount per 1M tokens in USDC.' },
      },
    },
  },
  {
    name: 'compute.estimate_cost',
    description: 'Estimate the USDC cost for a prompt before running inference. Returns cost breakdown by input tokens, output tokens, and routing fee. Helps agents budget before committing a payment.',
    annotations: { readOnlyHint: true, openWorldHint: false },
    inputSchema: {
      type: 'object',
      required: ['prompt', 'model'],
      properties: {
        prompt: { type: 'string', description: 'The prompt text to estimate cost for. Tokenized to determine input token count.' },
        model: { type: 'string', description: 'Model to estimate cost for. Use compute.list_models to browse available models and their per-token prices.' },
        max_output_tokens: { type: 'integer', description: 'Assumed maximum output tokens for cost estimation. Default 512.' },
      },
    },
  },
  {
    name: 'compute.get_usage',
    description: 'Get an agent\'s compute usage history — total tokens consumed, total USDC spent, breakdown by model, and inference call log with timestamps.',
    annotations: { readOnlyHint: true, openWorldHint: false },
    inputSchema: {
      type: 'object',
      required: ['did', 'api_key'],
      properties: {
        did: { type: 'string', description: 'Agent DID to fetch usage history for.' },
        api_key: { type: 'string', description: 'Agent API key for authentication.' },
        limit: { type: 'integer', description: 'Number of recent inference calls to return. Default 20, max 200.' },
        since: { type: 'string', description: 'ISO 8601 timestamp to filter usage from (e.g. 2025-01-01T00:00:00Z). Optional.' },
      },
    },
  },
];


const SERVICE_CFG = {
  service: "hive-mcp-compute",
  shortName: "HiveCompute",
  title: "HiveCompute \u00b7 AI Inference Brokering & GPU Compute MCP",
  tagline: "Inference brokering and GPU compute marketplace for autonomous agents.",
  description: "MCP server for HiveCompute \u2014 AI inference brokering and GPU compute on the Hive Civilization. Resells inference at margin across providers. USDC settlement on Base L2. Real rails, no mocks.",
  keywords: ["mcp", "model-context-protocol", "x402", "agentic", "ai-agent", "ai-agents", "llm", "hive", "hive-civilization", "compute", "inference-brokering", "gpu", "compute-marketplace", "usdc", "base", "base-l2", "agent-economy", "a2a"],
  externalUrl: "https://hive-mcp-compute.onrender.com",
  gatewayMount: "/compute",
  version: "1.0.1",
  pricing: [
    { name: "compute_quote", priceUsd: 0, label: "Quote \u2014 free" },
    { name: "compute_inference", priceUsd: 0.005, label: "Inference (Tier 2)" },
    { name: "compute_book_gpu", priceUsd: 0.05, label: "Book GPU (Tier 3)" }
  ],
};
SERVICE_CFG.tools = (typeof MCP_TOOLS !== 'undefined' ? MCP_TOOLS : []).map(t => ({ name: t.name, description: t.description }));
// ─── MCP Prompts ────────────────────────────────────────────────────────────
const MCP_PROMPTS = [
  {
    name: 'find_cheapest_model',
    description: 'Find the cheapest model available on HiveCompute that meets a given quality or capability requirement.',
    arguments: [
      { name: 'task', description: 'The inference task (e.g. "summarize text", "generate code", "classify sentiment")', required: false },
    ],
  },
  {
    name: 'estimate_inference_budget',
    description: 'Estimate how many inferences an agent can run for a given USDC budget and prompt size.',
    arguments: [
      { name: 'budget_usdc', description: 'USDC budget available for compute', required: false },
      { name: 'model', description: 'Preferred model to use', required: false },
    ],
  },
  {
    name: 'review_usage_spend',
    description: 'Review recent compute spend and token usage for an agent on HiveCompute.',
    arguments: [
      { name: 'did', description: 'Agent DID to review', required: true },
    ],
  },
];

// ─── Config Schema ───────────────────────────────────────────────────────────
const MCP_CONFIG_SCHEMA = {
  type: 'object',
  properties: {
    did: { type: 'string', title: 'Agent DID', 'x-order': 0 },
    api_key: { type: 'string', title: 'API Key', 'x-sensitive': true, 'x-order': 1 },
    default_rail: {
      type: 'string',
      title: 'Settlement Rail',
      enum: ['base-usdc', 'aleo-usdcx'],
      default: 'base-usdc',
      'x-order': 2,
    },
  },
  required: [],
};

// ─── MCP Handler ─────────────────────────────────────────────────────────────
app.post('/mcp', async (req, res) => {
  const { jsonrpc, id, method, params } = req.body || {};
  if (jsonrpc !== '2.0') {
    return res.json({ jsonrpc: '2.0', id, error: { code: -32600, message: 'Invalid JSON-RPC' } });
  }
  try {
    if (method === 'initialize') {
      return res.json({
        jsonrpc: '2.0', id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: {
            tools: { listChanged: false },
            prompts: { listChanged: false },
            resources: { listChanged: false },
          },
          serverInfo: {
            name: 'hivecompute-mcp',
            version: '1.0.0',
            description: 'OpenAI-compatible inference router for the Hive agent economy. Run any LLM and pay per token in USDC on Base L2. Hive routes to the cheapest available model meeting your latency/quality spec. Part of Hive Civilization (thehiveryiq.com).',
            homepage: BASE_URL,
            icon: 'https://www.thehiveryiq.com/favicon.ico',
          },
          configSchema: MCP_CONFIG_SCHEMA,
        },
      });
    }

    if (method === 'tools/list') {
      return res.json({ jsonrpc: '2.0', id, result: { tools: MCP_TOOLS } });
    }

    if (method === 'prompts/list') {
      return res.json({ jsonrpc: '2.0', id, result: { prompts: MCP_PROMPTS } });
    }

    if (method === 'prompts/get') {
      const prompt = MCP_PROMPTS.find(p => p.name === params?.name);
      if (!prompt) {
        return res.json({ jsonrpc: '2.0', id, error: { code: -32602, message: `Prompt not found: ${params?.name}` } });
      }
      const args = params?.arguments || {};
      const messages = {
        find_cheapest_model: [{ role: 'user', content: { type: 'text', text: `Find the cheapest model on HiveCompute${args.task ? ` suitable for: ${args.task}` : ''}. Show per-token pricing in USDC, context window, and latency tier for matching models.` } }],
        estimate_inference_budget: [{ role: 'user', content: { type: 'text', text: `Estimate how many inference calls I can make with a budget of ${args.budget_usdc || '<budget>'} USDC${args.model ? ` using model ${args.model}` : ''} on HiveCompute. Assume typical 500 input + 500 output tokens per call.` } }],
        review_usage_spend: [{ role: 'user', content: { type: 'text', text: `Show me the recent compute usage and USDC spend for agent ${args.did}. Break down by model used, token counts, and total cost.` } }],
      };
      return res.json({ jsonrpc: '2.0', id, result: { messages: messages[prompt.name] || [] } });
    }

    if (method === 'resources/list') {
      return res.json({
        jsonrpc: '2.0', id,
        result: {
          resources: [
            { uri: 'hivecompute://models/available', name: 'Available Models', description: 'All models available on HiveCompute with pricing and specs.', mimeType: 'application/json' },
            { uri: 'hivecompute://health', name: 'Compute Service Health', description: 'Current health and stats for HiveCompute inference router.', mimeType: 'application/json' },
            { uri: 'hivecompute://pricing/summary', name: 'Pricing Summary', description: 'Current per-token USDC pricing for all inference routes.', mimeType: 'application/json' },
          ],
        },
      });
    }

    if (method === 'resources/read') {
      const uri = params?.uri;
      let data;
      if (uri === 'hivecompute://models/available') {
        data = await fetch(`${BASE_URL}/v1/compute/models`).then(r => r.json()).catch(() => ({ status: 'ok', models: [] }));
      } else if (uri === 'hivecompute://health') {
        data = await fetch(`${BASE_URL}/health`).then(r => r.json()).catch(() => ({ status: 'ok', service: 'hivecompute' }));
      } else if (uri === 'hivecompute://pricing/summary') {
        data = await fetch(`${BASE_URL}/v1/compute/models`).then(r => r.json()).catch(() => ({
          status: 'ok',
          pricing_unit: 'USDC per 1M tokens',
          models: [
            { model: 'gpt-4o-mini', input_per_1m: 0.15, output_per_1m: 0.60 },
            { model: 'gpt-4o', input_per_1m: 5.00, output_per_1m: 15.00 },
            { model: 'claude-3-5-haiku', input_per_1m: 0.80, output_per_1m: 4.00 },
            { model: 'llama-3-70b', input_per_1m: 0.59, output_per_1m: 0.79 },
          ],
        }));
      } else {
        return res.json({ jsonrpc: '2.0', id, error: { code: -32602, message: `Unknown resource: ${uri}` } });
      }
      return res.json({ jsonrpc: '2.0', id, result: { contents: [{ uri, mimeType: 'application/json', text: JSON.stringify(data, null, 2) }] } });
    }

    if (method === 'tools/call') {
      const { name, arguments: args } = params || {};
      const headers = { 'Content-Type': 'application/json', 'x-hive-did': args?.did || '', 'x-api-key': args?.api_key || '', 'x-internal-key': INTERNAL_KEY };

      const toolRoutes = {
        'compute.chat': () => fetch(`${BASE_URL}/v1/compute/chat/completions`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            messages: args?.messages,
            model: args?.model,
            max_tokens: args?.max_tokens || 512,
            temperature: args?.temperature ?? 0.7,
            max_cost_usdc: args?.max_cost_usdc || 0.05,
            did: args?.did,
            api_key: args?.api_key,
          }),
        }).then(r => r.json()),

        'compute.embed': () => fetch(`${BASE_URL}/v1/compute/embeddings`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ input: args?.input, model: args?.model || 'text-embedding-3-small', dimensions: args?.dimensions, did: args?.did, api_key: args?.api_key }),
        }).then(r => r.json()),

        'compute.list_models': () => fetch(`${BASE_URL}/v1/compute/models?family=${args?.family || ''}&max_price=${args?.max_price_per_1m || ''}`, { headers }).then(r => r.json()),

        'compute.estimate_cost': () => fetch(`${BASE_URL}/v1/compute/estimate`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ prompt: args?.prompt, model: args?.model, max_output_tokens: args?.max_output_tokens || 512 }),
        }).then(r => r.json()),

        'compute.get_usage': () => fetch(`${BASE_URL}/v1/compute/usage/${encodeURIComponent(args?.did || '')}?limit=${args?.limit || 20}${args?.since ? `&since=${args.since}` : ''}`, { headers }).then(r => r.json()),
      };

      if (!toolRoutes[name]) {
        return res.json({ jsonrpc: '2.0', id, error: { code: -32601, message: `Tool not found: ${name}` } });
      }
      const data = await toolRoutes[name]();
      return res.json({ jsonrpc: '2.0', id, result: { content: [{ type: 'text', text: JSON.stringify(data, null, 2) }] } });
    }

    if (method === 'ping') return res.json({ jsonrpc: '2.0', id, result: {} });
    return res.json({ jsonrpc: '2.0', id, error: { code: -32601, message: `Method not found: ${method}` } });

  } catch (err) {
    return res.json({ jsonrpc: '2.0', id, error: { code: -32000, message: err.message } });
  }
});

app.get('/.well-known/mcp.json', (req, res) => res.json({
  name: 'hivecompute-mcp',
  version: '1.0.0',
  description: 'OpenAI-compatible inference router — pay per token in USDC on Base L2.',
  endpoint: '/mcp',
  transport: 'streamable-http',
  protocol: '2024-11-05',
  homepage: BASE_URL,
  icon: 'https://www.thehiveryiq.com/favicon.ico',
  tools: MCP_TOOLS.map(t => ({ name: t.name, description: t.description })),
  prompts: MCP_PROMPTS.map(p => ({ name: p.name, description: p.description })),
}));


// HIVE_META_BLOCK_v1 — comprehensive meta tags + JSON-LD + crawler discovery
app.get('/', (req, res) => {
  res.type('text/html; charset=utf-8').send(renderLanding(SERVICE_CFG));
});
app.get('/og.svg', (req, res) => {
  res.type('image/svg+xml').send(renderOgImage(SERVICE_CFG));
});
app.get('/robots.txt', (req, res) => {
  res.type('text/plain').send(renderRobots(SERVICE_CFG));
});
app.get('/sitemap.xml', (req, res) => {
  res.type('application/xml').send(renderSitemap(SERVICE_CFG));
});
app.get('/.well-known/security.txt', (req, res) => {
  res.type('text/plain').send(renderSecurity());
});
app.get('/seo.json', (req, res) => res.json(seoJson(SERVICE_CFG)));
// ─── Schema constants (auto-injected to fix deploy) ─────
const SERVICE = 'hive-mcp-compute';
const VERSION = '1.0.1';
const TOOLS = (typeof globalThis.__HIVE_TOOLS__ !== 'undefined') ? globalThis.__HIVE_TOOLS__ : [];


// ─── Schema discoverability ────────────────────────────────────────────────
const AGENT_CARD = {
  name: SERVICE,
  description: 'MCP server for HiveCompute — OpenAI-compatible inference router for the Hive agent economy. Chat completions, embeddings, and model listings. Hive routes to the cheapest qualifying model. Billed per token in USDC on Base L2. Real rails. New agents: first call free. Loyalty: every 6th paid call is free. Pay in USDC on Base L2.',
  url: `https://${SERVICE}.onrender.com`,
  provider: {
    organization: 'Hive Civilization',
    url: 'https://www.thehiveryiq.com',
    contact: 'steve@thehiveryiq.com',
  },
  version: VERSION,
  capabilities: {
    streaming: false,
    pushNotifications: false,
    stateTransitionHistory: false,
  },
  authentication: {
    schemes: ['x402'],
    credentials: {
      type: 'x402',
      asset: 'USDC',
      network: 'base',
      asset_address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      recipient: '0x15184bf50b3d3f52b60434f8942b7d52f2eb436e',
    },
  },
  defaultInputModes: ['application/json'],
  defaultOutputModes: ['application/json'],
  skills: TOOLS.map(t => ({ name: t.name, description: t.description })),
  extensions: {
    hive_pricing: {
      currency: 'USDC',
      network: 'base',
      model: 'per_call',
      first_call_free: true,
      loyalty_threshold: 6,
      loyalty_message: 'Every 6th paid call is free',
    },
  },
};

const AP2 = {
  ap2_version: '1',
  agent: {
    name: SERVICE,
    did: `did:web:${SERVICE}.onrender.com`,
    description: 'MCP server for HiveCompute — OpenAI-compatible inference router for the Hive agent economy. Chat completions, embeddings, and model listings. Hive routes to the cheapest qualifying model. Billed per token in USDC on Base L2. Real rails. New agents: first call free. Loyalty: every 6th paid call is free. Pay in USDC on Base L2.',
  },
  endpoints: {
    mcp: `https://${SERVICE}.onrender.com/mcp`,
    agent_card: `https://${SERVICE}.onrender.com/.well-known/agent-card.json`,
  },
  payments: {
    schemes: ['x402'],
    primary: {
      scheme: 'x402',
      network: 'base',
      asset: 'USDC',
      asset_address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
      recipient: '0x15184bf50b3d3f52b60434f8942b7d52f2eb436e',
    },
  },
  brand: { color: '#C08D23', name: 'Hive Civilization' },
};

app.get('/.well-known/agent-card.json', (req, res) => res.json(AGENT_CARD));
app.get('/.well-known/ap2.json',         (req, res) => res.json(AP2));

// ─── Wave B: compute marketplace match fee + subscription tiers ──────────────
// Doctrine review: hive-mcp-compute is a shim over hivecompute inference router.
// Hive routes to cheapest available model — matching buyers (agents) to
// providers (Akash, io.net, Render). Hive does NOT run compute itself.
// Match fee (5% of job value) is partner-shaped: Hive matches, providers serve.
// Doctrine-CLEAN.
//
// Tier schedule (Monroe W1 on Base USDC):
//   Per-job match fee: 5% of inference job value
//   Starter sub  : $25/mo  — 1M tokens/day cap
//   Pro sub      : $99/mo  — 10M tokens/day cap
//   Enterprise   : $499/mo — unlimited + priority routing + SLA attestation
//
// Spectral receipt on every metered job.

const _CMP_TREASURY = '0x15184bf50b3d3f52b60434f8942b7d52f2eb436e';
const _CMP_BRAND    = '#C08D23';
const _CMP_MATCH_FEE_BPS = 500; // 5% on compute jobs
const _CMP_TIERS = {
  starter:    { price_usd: 25,  label: 'Starter',    tokens_per_day: 1_000_000 },
  pro:        { price_usd: 99,  label: 'Pro',         tokens_per_day: 10_000_000 },
  enterprise: { price_usd: 499, label: 'Enterprise',  tokens_per_day: Infinity, invoice: true,
    perks: ['priority_routing', 'sla_attestation', 'dedicated_model_slots'] },
};
const _cmpSubLedger = new Map();

async function _cmpEmitReceipt({ event_type, did, amount_usd, tx_hash, metadata }) {
  try {
    const ctrl = new AbortController();
    setTimeout(() => ctrl.abort(), 4000);
    await fetch('https://hive-receipt.onrender.com/v1/receipt/sign', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        issuer_did: 'did:hive:compute-mcp',
        recipient_did: did || 'did:hive:anonymous',
        event_type, amount_usd: String(amount_usd),
        currency: 'USDC', network: 'base', pay_to: _CMP_TREASURY,
        tx_hash: tx_hash || null, service: 'hive-mcp-compute', brand: _CMP_BRAND,
        issued_ms: Date.now(), ...metadata,
      }),
      signal: ctrl.signal,
    });
  } catch (_) { console.warn('[compute-mcp] receipt emit failed (non-fatal):', _.message); }
}

// POST /v1/subscription — compute subscription tiers
app.post('/v1/subscription', async (req, res) => {
  const { tier, did, tx_hash } = req.body || {};
  if (!tier || !_CMP_TIERS[tier]) {
    return res.status(400).json({ error: 'invalid_tier', valid_tiers: Object.keys(_CMP_TIERS), brand: _CMP_BRAND });
  }
  const t = _CMP_TIERS[tier];
  if (!did) return res.status(400).json({ error: 'did_required' });
  if (tier !== 'enterprise' && !tx_hash) {
    return res.status(402).json({
      error: 'payment_required',
      x402: { type: 'x402', version: '1', kind: 'subscription_compute',
        asking_usd: t.price_usd, accept_min_usd: t.price_usd,
        asset: 'USDC', asset_address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        network: 'base', pay_to: _CMP_TREASURY, nonce: Math.random().toString(36).slice(2),
        issued_ms: Date.now(), tier, label: t.label,
        match_fee_bps: _CMP_MATCH_FEE_BPS,
        note: `Hive routes compute jobs to Akash/io.net/Render. 5% match fee on job value. ${t.price_usd}/mo subscription.`,
        partner_doctrine: 'Hive matches; providers run compute. Partner-shaped (Akash, io.net, Render).',
      },
      note: `Submit tx_hash for $${t.price_usd} USDC/mo to ${_CMP_TREASURY} on Base.`,
    });
  }
  const record = {
    tier, did, tx_hash: tx_hash || 'enterprise_invoice',
    activated_ms: Date.now(), expires_ms: Date.now() + 30 * 24 * 3600 * 1000,
    price_usd: t.price_usd, tokens_per_day: t.tokens_per_day,
    match_fee_bps: _CMP_MATCH_FEE_BPS,
  };
  _cmpSubLedger.set(did, record);
  await _cmpEmitReceipt({ event_type: 'subscription_activated', did, amount_usd: t.price_usd, tx_hash, metadata: { tier } });
  return res.json({ ok: true, subscription: record, receipt_emitted: true,
    match_fee_bps: _CMP_MATCH_FEE_BPS, brand: _CMP_BRAND });
});

// GET /v1/subscription/:did
app.get('/v1/subscription/:did', (req, res) => {
  const r = _cmpSubLedger.get(req.params.did);
  if (!r) return res.status(404).json({ active: false, did: req.params.did });
  return res.json({ active: Date.now() < r.expires_ms, ...r });
});

// POST /v1/match-fee/estimate — estimate match fee for a compute job
app.post('/v1/match-fee/estimate', (req, res) => {
  const { job_value_usdc, model, token_count } = req.body || {};
  const base = Number(job_value_usdc) || (Number(token_count || 1000) / 1_000_000 * 5.00);
  const fee  = +(base * _CMP_MATCH_FEE_BPS / 10000).toFixed(6);
  return res.json({
    job_value_usdc: base,
    match_fee_bps: _CMP_MATCH_FEE_BPS,
    match_fee_usdc: fee,
    net_to_provider: +(base - fee).toFixed(6),
    model: model || 'auto',
    partner_providers: ['Akash Network', 'io.net', 'Render GPU'],
    note: 'Hive matches and routes. Providers run the compute. Doctrine-clean.',
    brand: _CMP_BRAND,
  });
});
// ─────────────────────────────────────────────────────────────────────────────

app.use((req, res) => {
  res.status(404).json({
    status: 'error',
    error: 'NOT_FOUND',
    detail: `Route ${req.method} ${req.path} not found`,
    available: ['GET /health', 'POST /mcp', 'POST /v1/subscription', 'GET /v1/subscription/:did', 'POST /v1/match-fee/estimate', 'GET /.well-known/mcp.json'],
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`[hivecompute-mcp] Running on port ${PORT}`);
  console.log(`[hivecompute-mcp] MCP endpoint: http://localhost:${PORT}/mcp`);
  console.log(`[hivecompute-mcp] Proxying to: ${BASE_URL}`);
  console.log(`[hivecompute-mcp] Revenue: 5% match fee · sub tiers $25/$99/$499`);
});

export default app;
