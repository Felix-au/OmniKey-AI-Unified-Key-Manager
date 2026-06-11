import crypto from 'crypto';
import { Router } from 'express';
import type { Request, Response } from 'express';
import { z } from 'zod';
import multer from 'multer';
import type { ChatMessage } from '@omnikey-ai/shared/types.js';
import { routeRequest, recordRateLimitHit, recordSuccess, type RouteResult } from '../services/router.js';
import { recordRequest, recordTokens, setCooldown } from '../services/ratelimit.js';
import { getDb, getUnifiedApiKey } from '../db/index.js';
import { contentToString } from '../lib/content.js';
import { isLocalDbEnabled, dbModeStorage } from '../db/context.js';
import { UserSettings } from '../models/UserSettings.js';
import { RequestLog } from '../models/RequestLog.js';
import { Model } from '../models/Model.js';
import { PromoUser } from '../models/PromoUser.js';

export const proxyRouter = Router();

const upload = multer({ limits: { fileSize: 25 * 1024 * 1024 } });

async function authenticateRequest(req: Request): Promise<{ authenticated: boolean; userId: string; isLocal: boolean }> {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');
  if (!token) {
    return { authenticated: false, userId: '', isLocal: false };
  }

  let isLocal = !process.env.MONGODB_URI;
  let authenticated = false;
  let userId = 'local-dev-user-uid';

  if (process.env.MONGODB_URI && token.startsWith('omnikey-')) {
    try {
      const settings = await UserSettings.findOne({ unifiedApiKey: token });
      if (settings) {
        userId = settings.userId;
        isLocal = false;
        authenticated = true;
      }
    } catch (e) {
      console.warn('[Proxy] Failed to query MongoDB key:', e);
    }
  }

  if (!authenticated) {
    try {
      const unifiedKey = getUnifiedApiKey();
      if (timingSafeStringEqual(token, unifiedKey)) {
        isLocal = true;
        authenticated = true;
      }
    } catch (e) {
      console.warn('[Proxy] Failed to query SQLite key:', e);
    }
  }

  return { authenticated, userId, isLocal };
}

// Virtual "auto" model.
const AUTO_MODEL_ID = 'auto';

function isAutoModel(modelId: string | undefined): boolean {
  return modelId === AUTO_MODEL_ID;
}

// Constant-time string comparison for the unified API key.
function timingSafeStringEqual(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  const compareA = a.length === b.length ? a : Buffer.alloc(b.length);
  return crypto.timingSafeEqual(compareA, b) && a.length === b.length;
}

// Sticky sessions
const stickySessionMap = new Map<string, { modelDbId: number | string; lastUsed: number }>();
const STICKY_TTL_MS = 30 * 60 * 1000; // 30 min session TTL

function getSessionKey(messages: ChatMessage[]): string {
  const firstUser = messages.find(m => m.role === 'user');
  if (!firstUser || typeof firstUser.content !== 'string') return '';
  const hash = crypto.createHash('sha1').update(firstUser.content).digest('hex');
  return `${hash}:${messages.length > 2 ? 'multi' : 'single'}`;
}

function getStickyModel(messages: ChatMessage[]): number | string | undefined {
  const hasAssistant = messages.some(m => m.role === 'assistant');
  if (!hasAssistant) return undefined;

  const key = getSessionKey(messages);
  if (!key) return undefined;

  const entry = stickySessionMap.get(key);
  if (!entry) return undefined;

  if (Date.now() - entry.lastUsed > STICKY_TTL_MS) {
    stickySessionMap.delete(key);
    return undefined;
  }
  return entry.modelDbId;
}

function setStickyModel(messages: ChatMessage[], modelDbId: number | string) {
  const key = getSessionKey(messages);
  if (!key) return;
  stickySessionMap.set(key, { modelDbId, lastUsed: Date.now() });

  if (stickySessionMap.size > 500) {
    const now = Date.now();
    for (const [k, v] of stickySessionMap) {
      if (now - v.lastUsed > STICKY_TTL_MS) stickySessionMap.delete(k);
    }
  }
}

// OpenAI-compatible /models endpoint
proxyRouter.get('/models', async (req: Request, res: Response, next) => {
  try {
    if (isLocalDbEnabled()) {
      const db = getDb();
      const models = db.prepare('SELECT platform, model_id, display_name, context_window FROM models WHERE enabled = 1 ORDER BY intelligence_rank').all() as any[];
      return res.json({
        object: 'list',
        data: [
          {
            id: AUTO_MODEL_ID,
            object: 'model',
            created: 0,
            owned_by: 'omnikey',
            name: 'Auto (router picks the best available model)',
            context_window: null,
          },
          ...models.map(m => ({
            id: m.model_id,
            object: 'model',
            created: 0,
            owned_by: m.platform,
            name: m.display_name,
            context_window: m.context_window,
          })),
        ],
      });
    } else {
      const models = await Model.find({ enabled: true }).sort({ intelligenceRank: 1 });
      return res.json({
        object: 'list',
        data: [
          {
            id: AUTO_MODEL_ID,
            object: 'model',
            created: 0,
            owned_by: 'omnikey',
            name: 'Auto (router picks the best available model)',
            context_window: null,
          },
          ...models.map(m => ({
            id: m.modelId,
            object: 'model',
            created: 0,
            owned_by: m.platform,
            name: m.displayName,
            context_window: m.contextWindow,
          })),
        ],
      });
    }
  } catch (err) {
    next(err);
  }
});

const MAX_RETRIES = 20;

const toolCallSchema = z.object({
  id: z.string().min(1),
  type: z.literal('function'),
  function: z.object({
    name: z.string().min(1),
    arguments: z.string(),
  }),
  thought_signature: z.string().optional(),
});

const contentBlockSchema = z.object({ type: z.string() }).passthrough();
const contentSchema = z.union([z.string(), z.array(contentBlockSchema)]);

function hasNonEmptyContent(content: unknown): boolean {
  if (typeof content === 'string') return content.length > 0;
  if (Array.isArray(content)) return content.length > 0;
  return false;
}

const systemMessageSchema = z.object({
  role: z.literal('system'),
  content: contentSchema,
  name: z.string().optional(),
});

const userMessageSchema = z.object({
  role: z.literal('user'),
  content: contentSchema,
  name: z.string().optional(),
});

const assistantMessageSchema = z.object({
  role: z.literal('assistant'),
  content: z.union([contentSchema, z.null()]).optional(),
  name: z.string().optional(),
  tool_calls: z.array(toolCallSchema).optional(),
}).refine((msg) => {
  const hasContent = hasNonEmptyContent(msg.content);
  const hasToolCalls = (msg.tool_calls?.length ?? 0) > 0;
  return hasContent || hasToolCalls;
}, {
  message: 'assistant messages must include non-empty content or tool_calls',
});

const toolMessageSchema = z.object({
  role: z.literal('tool'),
  content: contentSchema,
  tool_call_id: z.string().min(1),
  name: z.string().optional(),
});

const toolDefinitionSchema = z.object({
  type: z.literal('function'),
  function: z.object({
    name: z.string().min(1),
    description: z.string().optional(),
    parameters: z.record(z.string(), z.unknown()).optional(),
    strict: z.boolean().optional(),
  }),
});

const toolChoiceSchema = z.union([
  z.enum(['none', 'auto', 'required']),
  z.object({
    type: z.literal('function'),
    function: z.object({
      name: z.string().min(1),
    }),
  }),
]);

const chatCompletionSchema = z.object({
  messages: z.array(z.union([
    systemMessageSchema,
    userMessageSchema,
    assistantMessageSchema,
    toolMessageSchema,
  ])).min(1),
  model: z.string().optional(),
  temperature: z.number().min(0).max(2).optional(),
  max_tokens: z.number().int().positive().optional(),
  top_p: z.number().min(0).max(1).optional(),
  stream: z.boolean().optional(),
  tools: z.array(toolDefinitionSchema).optional(),
  tool_choice: toolChoiceSchema.optional(),
  parallel_tool_calls: z.boolean().optional(),
});

export function isRetryableError(err: any): boolean {
  const msg = (err.message ?? '').toLowerCase();
  return msg.includes('429') || msg.includes('rate limit') || msg.includes('too many requests')
    || msg.includes('quota') || msg.includes('resource_exhausted')
    || msg.includes('aborted') || msg.includes('timeout') || msg.includes('etimedout')
    || msg.includes('econnrefused') || msg.includes('econnreset')
    || msg.includes('503') || msg.includes('unavailable')
    || msg.includes('500') || msg.includes('internal server error')
    || msg.includes('413') || msg.includes('payload too large') || msg.includes('request body too large')
    || msg.includes('request entity too large') || msg.includes('content too large')
    || msg.includes('404') || msg.includes('not found') || msg.includes('no endpoints found');
}

proxyRouter.post('/chat/completions', async (req: Request, res: Response) => {
  const start = Date.now();
  let userId = 'local-dev-user-uid';
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, '');

  if (!token) {
    res.status(401).json({
      error: { message: 'Missing API key', type: 'authentication_error' },
    });
    return;
  }

  // Auto-detect database mode based on the timing-safe key itself
  let isLocal = !process.env.MONGODB_URI;
  let authenticated = false;

  // 1. Check cloud database (if URI present)
  if (process.env.MONGODB_URI && token.startsWith('omnikey-')) {
    try {
      const settings = await UserSettings.findOne({ unifiedApiKey: token });
      if (settings) {
        userId = settings.userId;
        isLocal = false;
        authenticated = true;
      }
    } catch (e) {
      console.warn('[Proxy] Failed to query MongoDB key:', e);
    }
  }

  // 2. Fall back to local SQLite
  if (!authenticated) {
    try {
      const unifiedKey = getUnifiedApiKey();
      if (timingSafeStringEqual(token, unifiedKey)) {
        isLocal = true;
        authenticated = true;
      }
    } catch (e) {
      console.warn('[Proxy] Failed to query SQLite key:', e);
    }
  }

  if (!authenticated) {
    res.status(401).json({
      error: { message: 'Invalid API key', type: 'authentication_error' },
    });
    return;
  }

  // Wrap the entire request logic inside the appropriate database context
  await dbModeStorage.run(isLocal ? 'local' : 'cloud', async () => {
    // 2. Validate request payload
    const parsed = chatCompletionSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        error: {
          message: `Invalid request: ${parsed.error.errors.map(e => e.message).join(', ')}`,
          type: 'invalid_request_error',
        },
      });
      return;
    }

    const { model: requestedModel, temperature, max_tokens, top_p, stream, tools, tool_choice, parallel_tool_calls } = parsed.data;
    const messages: ChatMessage[] = parsed.data.messages.map((m): ChatMessage => {
      if (m.role === 'assistant') {
        return {
          role: 'assistant',
          content: m.content ?? null,
          ...(m.name ? { name: m.name } : {}),
          ...(m.tool_calls ? { tool_calls: m.tool_calls.map(tc => ({
            id: tc.id,
            type: tc.type,
            function: tc.function,
            thought_signature: tc.thought_signature,
          })) } : {}),
        };
      }

      if (m.role === 'tool') {
        return {
          role: 'tool',
          content: m.content,
          tool_call_id: m.tool_call_id,
          ...(m.name ? { name: m.name } : {}),
        };
      }

      return {
        role: m.role,
        content: m.content,
        ...(m.name ? { name: m.name } : {}),
      };
    });

    const estimatedInputTokens = messages.reduce((sum, m) => {
      let textLen = 0;
      let mediaTokens = 0;
      if (typeof m.content === 'string') {
        textLen = m.content.length;
      } else if (Array.isArray(m.content)) {
        for (const block of m.content) {
          if (block && typeof block === 'object') {
            const b = block as any;
            if (b.type === 'text' && typeof b.text === 'string') {
              textLen += b.text.length;
            } else if (b.type === 'image_url') {
              mediaTokens += 258;
            } else if (b.type === 'input_audio') {
              mediaTokens += 500;
            }
          }
        }
      }
      return sum + Math.ceil(textLen / 4) + mediaTokens;
    }, 0);
    const estimatedTotal = estimatedInputTokens + (max_tokens ?? 1000);

    // 3. Resolve preferred sticky / auto-routed model
    let preferredModel: number | string | undefined;
    if (isAutoModel(requestedModel)) {
      preferredModel = getStickyModel(messages);
    } else if (requestedModel) {
      if (isLocalDbEnabled()) {
        const db = getDb();
        const enabled = db.prepare('SELECT id FROM models WHERE model_id = ? AND enabled = 1').get(requestedModel) as { id: number } | undefined;
        if (enabled) {
          preferredModel = enabled.id;
        } else {
          const disabled = db.prepare('SELECT id FROM models WHERE model_id = ?').get(requestedModel) as { id: number } | undefined;
          const reason = disabled ? 'is disabled' : 'is not in the catalog';
          res.status(400).json({
            error: {
              message: `Model '${requestedModel}' ${reason}. Use 'auto' (or omit the 'model' field) to auto-route, or call /v1/models for the available list.`,
              type: 'invalid_request_error',
              code: 'model_not_found',
            },
          });
          return;
        }
      } else {
        const enabled = await Model.findOne({ modelId: requestedModel, enabled: true });
        if (enabled) {
          preferredModel = enabled._id.toString();
        } else {
          const disabled = await Model.findOne({ modelId: requestedModel });
          const reason = disabled ? 'is disabled' : 'is not in the catalog';
          res.status(400).json({
            error: {
              message: `Model '${requestedModel}' ${reason}. Use 'auto' (or omit the 'model' field) to auto-route, or call /v1/models for the available list.`,
              type: 'invalid_request_error',
              code: 'model_not_found',
            },
          });
          return;
        }
      }
    } else {
      preferredModel = getStickyModel(messages);
    }

    let requiredModality = req.headers['x-required-modality'] as string | undefined;

    // Detect dynamic multimodal content in message payload if header not present
    if (!requiredModality && Array.isArray(messages)) {
      for (const m of messages) {
        if (Array.isArray(m.content)) {
          for (const block of m.content) {
            if (block.type === 'image_url') {
              requiredModality = 'vision';
              break;
            }
            if (block.type === 'input_audio') {
              requiredModality = 'audio_input';
              break;
            }
          }
        }
        if (requiredModality) break;
      }
    }

    // 4. Retry scheduling loop
    const skipKeys = new Set<string>();
    let lastError: any = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      let route: RouteResult;
      try {
        route = await routeRequest(estimatedTotal, skipKeys.size > 0 ? skipKeys : undefined, preferredModel, userId, requiredModality);
      } catch (err: any) {
        if (lastError) {
          res.status(429).json({
            error: {
              message: `All models rate-limited. Last error: ${lastError.message}`,
              type: 'rate_limit_error',
            },
          });
        } else {
          res.status(err.status ?? 503).json({
            error: { message: err.message, type: 'routing_error' },
          });
        }
        return;
      }

      recordRequest(route.platform, route.modelId, route.keyId as any);

      try {
        if (stream) {
          let totalOutputTokens = 0;
          let streamStarted = false;
          try {
            const gen = route.provider.streamChatCompletion(
              route.apiKey, messages, route.modelId,
              { temperature, max_tokens, top_p, tools, tool_choice, parallel_tool_calls },
            );

            for await (const chunk of gen) {
              if (!streamStarted) {
                const keyUsed = (route.keyLabel && route.keyLabel.trim()) ? route.keyLabel.trim() : `Key #${route.keyId}`;
                res.setHeader('Content-Type', 'text/event-stream');
                res.setHeader('Cache-Control', 'no-cache');
                res.setHeader('Connection', 'keep-alive');
                if (route.isPromo) {
                  res.setHeader('X-Routed-Via', 'Promo Model');
                  res.setHeader('X-Key-Used', 'OmniKey Funded Key');
                } else {
                  res.setHeader('X-Routed-Via', `${route.platform}/${route.modelId}`);
                  res.setHeader('X-Key-Used', keyUsed);
                }
                if (attempt > 0) res.setHeader('X-Fallback-Attempts', String(attempt));
                streamStarted = true;
              }
              const text = chunk.choices[0]?.delta?.content ?? '';
              totalOutputTokens += Math.ceil(text.length / 4);
              if (route.isPromo && chunk && typeof chunk === 'object') {
                chunk.model = 'omnikey-promo';
              }
              res.write(`data: ${JSON.stringify(chunk)}\n\n`);
            }

            if (!streamStarted) {
              const keyUsed = (route.keyLabel && route.keyLabel.trim()) ? route.keyLabel.trim() : `Key #${route.keyId}`;
              res.setHeader('Content-Type', 'text/event-stream');
              if (route.isPromo) {
                res.setHeader('X-Routed-Via', 'Promo Model');
                res.setHeader('X-Key-Used', 'OmniKey Funded Key');
              } else {
                res.setHeader('X-Routed-Via', `${route.platform}/${route.modelId}`);
                res.setHeader('X-Key-Used', keyUsed);
              }
            }
            res.write('data: [DONE]\n\n');
            res.end();

            recordTokens(route.platform, route.modelId, route.keyId as any, estimatedInputTokens + totalOutputTokens);
            recordSuccess(route.modelDbId);
            setStickyModel(messages, route.modelDbId);
            logRequest(route.platform, route.modelId, 'success', estimatedInputTokens, totalOutputTokens, Date.now() - start, null, userId, route.isPromo ? route.fundedByUserId : undefined);
            return;
          } catch (streamErr: any) {
            if (streamStarted) {
              console.error(`[Proxy] Mid-stream error from ${route.displayName}:`, streamErr.message);
              const payload = { error: { message: `Provider error (${route.displayName}): stream interrupted`, type: 'stream_error' } };
              try { res.write(`data: ${JSON.stringify(payload)}\n\n`); } catch {}
              try { res.write('data: [DONE]\n\n'); res.end(); } catch {}
              logRequest(route.platform, route.modelId, 'error', estimatedInputTokens, totalOutputTokens, Date.now() - start, streamErr.message, userId, route.isPromo ? route.fundedByUserId : undefined);
              return;
            }
            throw streamErr;
          }
        } else {
          const result = await route.provider.chatCompletion(
            route.apiKey, messages, route.modelId,
            { temperature, max_tokens, top_p, tools, tool_choice, parallel_tool_calls },
          );

          const totalTokens = result.usage?.total_tokens ?? 0;
          recordTokens(route.platform, route.modelId, route.keyId as any, totalTokens);
          recordSuccess(route.modelDbId);
          setStickyModel(messages, route.modelDbId);

          const keyUsed = (route.keyLabel && route.keyLabel.trim()) ? route.keyLabel.trim() : `Key #${route.keyId}`;
          if (route.isPromo) {
            res.setHeader('X-Routed-Via', 'Promo Model');
            res.setHeader('X-Key-Used', 'OmniKey Funded Key');
          } else {
            res.setHeader('X-Routed-Via', `${route.platform}/${route.modelId}`);
            res.setHeader('X-Key-Used', keyUsed);
          }
          if (attempt > 0) res.setHeader('X-Fallback-Attempts', String(attempt));

          if (result && typeof result === 'object') {
            if (route.isPromo) {
              result.model = 'omnikey-promo';
              (result as any)._routed_via = {
                platform: 'Promo Pool',
                model: 'Promo Model',
                keyUsed: 'OmniKey Funded Key',
              };
            } else {
              (result as any)._routed_via = {
                platform: route.platform,
                model: route.modelId,
                keyUsed,
              };
            }
          }
          res.json(result);

          logRequest(
            route.platform, route.modelId, 'success',
            result.usage?.prompt_tokens ?? 0,
            result.usage?.completion_tokens ?? 0,
            Date.now() - start, null, userId,
            route.isPromo ? route.fundedByUserId : undefined
          );
          return;
        }
      } catch (err: any) {
        const latency = Date.now() - start;

        if (isRetryableError(err) && attempt < MAX_RETRIES - 1) {
          logRequest(route!.platform, route!.modelId, 'fallback', estimatedInputTokens, 0, latency, err.message, userId, route!.isPromo ? route!.fundedByUserId : undefined);
          const skipId = `${route!.platform}:${route!.modelId}:${route!.keyId}`;
          skipKeys.add(skipId);
          setCooldown(route!.platform, route!.modelId, route!.keyId as any, 120_000);
          recordRateLimitHit(route!.modelDbId);
          lastError = err;
          console.log(`[Proxy] ${err.message.slice(0, 60)} from ${route!.displayName}, falling back (attempt ${attempt + 1}/${MAX_RETRIES})`);
          continue;
        }

        logRequest(route!.platform, route!.modelId, 'error', estimatedInputTokens, 0, latency, err.message, userId, route!.isPromo ? route!.fundedByUserId : undefined);
        res.status(502).json({
          error: {
            message: `Provider error (${route!.displayName}): ${err.message}`,
            type: 'provider_error',
          },
        });
        return;
      }
    }

    res.status(429).json({
      error: {
        message: `All models rate-limited after ${MAX_RETRIES} attempts. Last: ${lastError?.message}`,
        type: 'rate_limit_error',
      },
    });
  });
});

proxyRouter.post('/audio/transcriptions', upload.single('file'), async (req: Request, res: Response) => {
  const start = Date.now();
  const auth = await authenticateRequest(req);
  if (!auth.authenticated) {
    res.status(401).json({
      error: { message: 'Invalid or missing API key', type: 'authentication_error' },
    });
    return;
  }

  await dbModeStorage.run(auth.isLocal ? 'local' : 'cloud', async () => {
    try {
      if (!req.file) {
        res.status(400).json({
          error: { message: 'Missing audio file in multipart form upload', type: 'invalid_request_error' },
        });
        return;
      }

      let preferredModelId: string | number | undefined;
      if (isLocalDbEnabled()) {
        const db = getDb();
        const model = db.prepare("SELECT id FROM models WHERE platform = 'google' AND enabled = 1 LIMIT 1").get() as { id: number } | undefined;
        if (model) preferredModelId = model.id;
      } else {
        const model = await Model.findOne({ platform: 'google', enabled: true });
        if (model) preferredModelId = model._id.toString();
      }

      if (!preferredModelId) {
        res.status(400).json({
          error: { message: 'No enabled Google models found to process audio', type: 'invalid_request_error' },
        });
        return;
      }

      const route = await routeRequest(5000, undefined, preferredModelId, auth.userId, 'audio_input');
      recordRequest(route.platform, route.modelId, route.keyId as any);

      const base64Audio = req.file.buffer.toString('base64');
      const mimeType = req.file.mimetype || 'audio/wav';

      const body = {
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: base64Audio,
                },
              },
              {
                text: 'Transcribe the audio. Output only the verbatim transcription text, do not add any explanations, commentary, or formatting.',
              },
            ],
          },
        ],
      };

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${route.modelId}:generateContent?key=${route.apiKey}`;
      const apiRes = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!apiRes.ok) {
        const err = await apiRes.json().catch(() => ({}));
        throw new Error(`Google API error ${apiRes.status}: ${(err as any).error?.message ?? apiRes.statusText}`);
      }

      const data = await apiRes.json() as any;
      const transcription = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

      const promptTokens = data.usageMetadata?.promptTokenCount || 1000;
      const completionTokens = data.usageMetadata?.candidatesTokenCount || 200;
      recordTokens(route.platform, route.modelId, route.keyId as any, promptTokens + completionTokens);
      recordSuccess(route.modelDbId);

      logRequest(
        route.platform, route.modelId, 'success',
        promptTokens, completionTokens,
        Date.now() - start, null, auth.userId,
        route.isPromo ? route.fundedByUserId : undefined
      );

      res.json({ text: transcription });
    } catch (err: any) {
      console.error('[Proxy] Audio transcription error:', err);
      res.status(502).json({
        error: { message: `Provider error: ${err.message}`, type: 'provider_error' },
      });
    }
  });
});

proxyRouter.post('/audio/voice-chat', upload.single('file'), async (req: Request, res: Response) => {
  const start = Date.now();
  const auth = await authenticateRequest(req);
  if (!auth.authenticated) {
    res.status(401).json({
      error: { message: 'Invalid or missing API key', type: 'authentication_error' },
    });
    return;
  }

  await dbModeStorage.run(auth.isLocal ? 'local' : 'cloud', async () => {
    try {
      if (!req.file) {
        res.status(400).json({
          error: { message: 'Missing audio file in multipart form upload', type: 'invalid_request_error' },
        });
        return;
      }

      let preferredModelId: string | number | undefined;
      if (isLocalDbEnabled()) {
        const db = getDb();
        const model = db.prepare("SELECT id FROM models WHERE platform = 'google' AND enabled = 1 LIMIT 1").get() as { id: number } | undefined;
        if (model) preferredModelId = model.id;
      } else {
        const model = await Model.findOne({ platform: 'google', enabled: true });
        if (model) preferredModelId = model._id.toString();
      }

      if (!preferredModelId) {
        res.status(400).json({
          error: { message: 'No enabled Google models found to process audio', type: 'invalid_request_error' },
        });
        return;
      }

      const route = await routeRequest(5000, undefined, preferredModelId, auth.userId, 'audio_input');
      recordRequest(route.platform, route.modelId, route.keyId as any);

      const base64Audio = req.file.buffer.toString('base64');
      const mimeType = req.file.mimetype || 'audio/wav';

      const body = {
        contents: [
          {
            parts: [
              {
                inlineData: {
                  mimeType,
                  data: base64Audio,
                },
              },
            ],
          },
        ],
      };

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${route.modelId}:generateContent?key=${route.apiKey}`;
      const apiRes = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!apiRes.ok) {
        const err = await apiRes.json().catch(() => ({}));
        throw new Error(`Google API error ${apiRes.status}: ${(err as any).error?.message ?? apiRes.statusText}`);
      }

      const data = await apiRes.json() as any;
      const transcription = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() || '';

      const promptTokens = data.usageMetadata?.promptTokenCount || 1000;
      const completionTokens = data.usageMetadata?.candidatesTokenCount || 200;
      recordTokens(route.platform, route.modelId, route.keyId as any, promptTokens + completionTokens);
      recordSuccess(route.modelDbId);

      logRequest(
        route.platform, route.modelId, 'success',
        promptTokens, completionTokens,
        Date.now() - start, null, auth.userId,
        route.isPromo ? route.fundedByUserId : undefined
      );

      res.json({ text: transcription });
    } catch (err: any) {
      console.error('[Proxy] Audio Voice Chat error:', err);
      res.status(502).json({
        error: { message: `Provider error: ${err.message}`, type: 'provider_error' },
      });
    }
  });
});

proxyRouter.post('/audio/speech', async (req: Request, res: Response) => {
  const start = Date.now();
  const auth = await authenticateRequest(req);
  if (!auth.authenticated) {
    res.status(401).json({
      error: { message: 'Invalid or missing API key', type: 'authentication_error' },
    });
    return;
  }

  await dbModeStorage.run(auth.isLocal ? 'local' : 'cloud', async () => {
    try {
      const { input, voice } = req.body;
      if (!input || typeof input !== 'string') {
        res.status(400).json({
          error: { message: 'Missing or invalid input text', type: 'invalid_request_error' },
        });
        return;
      }

      const voiceMap: Record<string, string> = {
        alloy: 'Kore',
        echo: 'Fenrir',
        fable: 'Aoede',
        onyx: 'Charon',
        nova: 'Puck',
        shimmer: 'Aoede',
      };
      const voiceName = voiceMap[String(voice).toLowerCase()] || 'Kore';

      let preferredModelId: string | number | undefined;
      if (isLocalDbEnabled()) {
        const db = getDb();
        const dbModel = db.prepare("SELECT id FROM models WHERE platform = 'google' AND enabled = 1 LIMIT 1").get() as { id: number } | undefined;
        if (dbModel) preferredModelId = dbModel.id;
      } else {
        const dbModel = await Model.findOne({ platform: 'google', enabled: true });
        if (dbModel) preferredModelId = dbModel._id.toString();
      }

      if (!preferredModelId) {
        res.status(400).json({
          error: { message: 'No enabled Google models found to process speech', type: 'invalid_request_error' },
        });
        return;
      }

      const estimatedTokens = Math.ceil(input.length / 4) + 1000;
      const route = await routeRequest(estimatedTokens, undefined, preferredModelId, auth.userId, 'audio_output');
      recordRequest(route.platform, route.modelId, route.keyId as any);

      const body = {
        contents: [
          {
            parts: [
              {
                text: input,
              },
            ],
          },
        ],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName,
              },
            },
          },
        },
      };

      const targetModelId = 'gemini-2.5-flash-preview-tts';
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${targetModelId}:generateContent?key=${route.apiKey}`;
      const apiRes = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!apiRes.ok) {
        const err = await apiRes.json().catch(() => ({}));
        throw new Error(`Google API error ${apiRes.status}: ${(err as any).error?.message ?? apiRes.statusText}`);
      }

      const data = await apiRes.json() as any;
      const candidatePart = data.candidates?.[0]?.content?.parts?.[0];
      
      if (!candidatePart?.inlineData?.data) {
        throw new Error('Gemini API did not return audio inlineData.');
      }

      let audioBuffer = Buffer.from(candidatePart.inlineData.data, 'base64');
      let mimeType = candidatePart.inlineData.mimeType || 'audio/mpeg';

      if (mimeType.includes('codec=pcm') || mimeType.includes('audio/L16')) {
        const wavHeader = writeWavHeader(audioBuffer.length, 24000, 1, 16);
        audioBuffer = Buffer.concat([wavHeader, audioBuffer]);
        mimeType = 'audio/wav';
      }

      const promptTokens = data.usageMetadata?.promptTokenCount || Math.ceil(input.length / 4);
      const completionTokens = data.usageMetadata?.candidatesTokenCount || 500;
      recordTokens(route.platform, route.modelId, route.keyId as any, promptTokens + completionTokens);
      recordSuccess(route.modelDbId);

      logRequest(
        route.platform, route.modelId, 'success',
        promptTokens, completionTokens,
        Date.now() - start, null, auth.userId,
        route.isPromo ? route.fundedByUserId : undefined
      );

      res.setHeader('Content-Type', mimeType);
      res.setHeader('Content-Length', audioBuffer.length);
      res.send(audioBuffer);
    } catch (err: any) {
      console.error('[Proxy] Audio speech synthesis error:', err);
      res.status(502).json({
        error: { message: `Provider error: ${err.message}`, type: 'provider_error' },
      });
    }
  });
});

function logRequest(
  platform: string,
  modelId: string,
  status: 'success' | 'error' | 'fallback',
  inputTokens: number,
  outputTokens: number,
  latencyMs: number,
  error: string | null,
  userId = 'local-dev-user-uid',
  fundedByUserId?: string
) {
  if (isLocalDbEnabled()) {
    try {
      const db = getDb();
      db.prepare(`
        INSERT INTO requests (platform, model_id, status, input_tokens, output_tokens, latency_ms, error)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(platform, modelId, status, inputTokens, outputTokens, latencyMs, error);
    } catch (e) {
      console.error('Failed to log request locally:', e);
    }
  } else {
    // Run asynchronous insertion in the background
    RequestLog.create({
      userId,
      fundedByUserId,
      platform,
      modelId,
      status,
      inputTokens,
      outputTokens,
      latencyMs,
      error
    }).catch(e => {
      console.error('Failed to log request to MongoDB:', e);
    });

    if (status === 'success') {
      PromoUser.findOne({ userId }).then(promo => {
        if (promo && promo.tokensUsed < promo.tokensLimit) {
          const totalTokens = inputTokens + outputTokens;
          promo.tokensUsed = Math.min(
            promo.tokensLimit,
            promo.tokensUsed + totalTokens
          );
          promo.save().catch(err => console.error('[Promo] Failed to save PromoUser tokens usage:', err));
        }
      }).catch(err => console.error('[Promo] Failed to find PromoUser:', err));
    }
  }
}

function writeWavHeader(pcmLength: number, sampleRate: number, numChannels: number, bitsPerSample: number): Buffer {
  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcmLength, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * numChannels * (bitsPerSample / 8), 28);
  header.writeUInt16LE(numChannels * (bitsPerSample / 8), 32);
  header.writeUInt16LE(bitsPerSample, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcmLength, 40);
  return header;
}
