import crypto from 'crypto';
import { Router } from 'express';
import type { Request, Response } from 'express';
import type { ChatMessage } from '@omnikey-ai/shared/types.js';
import { routeRequest, recordRateLimitHit, recordSuccess, type RouteResult } from '../services/router.js';
import { recordRequest, recordTokens, setCooldown } from '../services/ratelimit.js';
import { getDb, getUnifiedGeminiApiKey, getUnifiedApiKey } from '../db/index.js';
import { contentToString } from '../lib/content.js';
import { isLocalDbEnabled, dbModeStorage } from '../db/context.js';
import { UserSettings } from '../models/UserSettings.js';
import { RequestLog } from '../models/RequestLog.js';
import { Model } from '../models/Model.js';
import { PromoUser } from '../models/PromoUser.js';
import { ProjectKey } from '../models/ProjectKey.js';
import { isRetryableError } from './proxy.js';

export const geminiProxyRouter = Router();

const AUTO_MODEL_ID = 'auto';

// Constant-time string comparison for the unified API key.
function timingSafeStringEqual(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  const compareA = a.length === b.length ? a : Buffer.alloc(b.length);
  return crypto.timingSafeEqual(compareA, b) && a.length === b.length;
}

// Translate Gemini Request to internal format
export function translateGeminiRequest(body: any): {
  messages: ChatMessage[];
  temperature?: number;
  max_tokens?: number;
  top_p?: number;
  responseModalities?: string[];
  speechConfig?: unknown;
} {
  const messages: ChatMessage[] = [];

  // 1. Handle systemInstruction
  if (body.systemInstruction?.parts) {
    const sysParts = body.systemInstruction.parts;
    const text = sysParts.map((p: any) => p.text || '').join('\n').trim();
    if (text) {
      messages.push({
        role: 'system',
        content: text,
      });
    }
  }

  // 2. Handle contents
  if (Array.isArray(body.contents)) {
    for (const content of body.contents) {
      const role = content.role === 'model' ? 'assistant' : 'user';
      const parts = content.parts || [];

      if (parts.length === 1 && typeof parts[0].text === 'string') {
        messages.push({
          role,
          content: parts[0].text,
        });
      } else {
        const contentBlocks: any[] = [];
        for (const part of parts) {
          if (typeof part.text === 'string' && part.text) {
            contentBlocks.push({ type: 'text', text: part.text });
          } else if (part.inlineData && typeof part.inlineData === 'object') {
            const mimeType = String(part.inlineData.mimeType || '');
            const data = String(part.inlineData.data || '');
            if (mimeType.startsWith('image/')) {
              contentBlocks.push({
                type: 'image_url',
                image_url: {
                  url: `data:${mimeType};base64,${data}`,
                },
              });
            } else if (mimeType.startsWith('audio/')) {
              const format = mimeType.split('/')[1] || 'wav';
              contentBlocks.push({
                type: 'input_audio',
                input_audio: {
                  format,
                  data,
                },
              });
            }
          }
        }
        messages.push({
          role,
          content: contentBlocks,
        });
      }
    }
  }

  // 3. Handle generationConfig
  const config = body.generationConfig || {};
  return {
    messages,
    temperature: typeof config.temperature === 'number' ? config.temperature : undefined,
    max_tokens: typeof config.maxOutputTokens === 'number' ? config.maxOutputTokens : undefined,
    top_p: typeof config.topP === 'number' ? config.topP : undefined,
    responseModalities: Array.isArray(config.responseModalities) ? config.responseModalities : undefined,
    speechConfig: config.speechConfig || undefined,
  };
}

// Translate OpenAI response to Gemini format
export function translateToGeminiResponse(openaiResult: any, modelName: string): any {
  const messageContent = openaiResult.choices?.[0]?.message?.content;
  const finishReasonRaw = openaiResult.choices?.[0]?.finish_reason || 'stop';
  const finishReason = finishReasonRaw === 'length' ? 'MAX_TOKENS' : 'STOP';

  const parts: any[] = [];
  if (typeof messageContent === 'string') {
    parts.push({ text: messageContent });
  } else if (Array.isArray(messageContent)) {
    for (const block of messageContent) {
      if (block.type === 'text') {
        parts.push({ text: block.text });
      } else if (block.type === 'inline_data' && block.inlineData) {
        parts.push({
          inlineData: {
            mimeType: block.inlineData.mimeType,
            data: block.inlineData.data,
          },
        });
      }
    }
  }

  const usage = openaiResult.usage || {};
  return {
    candidates: [
      {
        content: {
          parts,
          role: 'model',
        },
        finishReason,
        index: 0,
      },
    ],
    usageMetadata: {
      promptTokenCount: usage.prompt_tokens || 0,
      candidatesTokenCount: usage.completion_tokens || 0,
      totalTokenCount: usage.total_tokens || 0,
    },
    modelVersion: modelName,
  };
}

// Translate OpenAI streaming chunk to Gemini format
export function translateToGeminiStreamChunk(openaiChunk: any): any {
  const deltaText = openaiChunk.choices?.[0]?.delta?.content || '';
  const finishReasonRaw = openaiChunk.choices?.[0]?.finish_reason;
  const finishReason = finishReasonRaw ? (finishReasonRaw === 'length' ? 'MAX_TOKENS' : 'STOP') : undefined;

  const parts: any[] = [];
  if (deltaText) {
    parts.push({ text: deltaText });
  }

  const inlineData = openaiChunk.choices?.[0]?.delta?.inline_data;
  if (Array.isArray(inlineData)) {
    for (const item of inlineData) {
      parts.push({
        inlineData: {
          mimeType: item.mimeType,
          data: item.data,
        },
      });
    }
  }

  const candidate: any = {
    content: {
      parts,
      role: 'model',
    },
    index: 0,
  };
  if (finishReason) {
    candidate.finishReason = finishReason;
  }

  const chunk: any = {
    candidates: [candidate],
  };

  if (openaiChunk.usage) {
    chunk.usageMetadata = {
      promptTokenCount: openaiChunk.usage.prompt_tokens || 0,
      candidatesTokenCount: openaiChunk.usage.completion_tokens || 0,
      totalTokenCount: openaiChunk.usage.total_tokens || 0,
    };
  }

  return chunk;
}

function logRequest(
  platform: string,
  modelId: string,
  status: 'success' | 'error' | 'fallback',
  inputTokens: number,
  outputTokens: number,
  latencyMs: number,
  error: string | null,
  userId = 'local-dev-user-uid',
  fundedByUserId?: string,
  projectKey?: string
) {
  if (isLocalDbEnabled()) {
    try {
      const db = getDb();
      db.prepare(`
        INSERT INTO requests (platform, model_id, status, input_tokens, output_tokens, latency_ms, error, project_key)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(platform, modelId, status, inputTokens, outputTokens, latencyMs, error, projectKey || null);
    } catch (e) {
      console.error('Failed to log request locally:', e);
    }
  } else {
    RequestLog.create({
      userId,
      fundedByUserId,
      platform,
      modelId,
      status,
      inputTokens,
      outputTokens,
      latencyMs,
      error,
      projectKey: projectKey || null
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

// Gemini-compatible Models List API
geminiProxyRouter.get('/models', async (req: Request, res: Response, next) => {
  try {
    let models: any[] = [];
    if (isLocalDbEnabled()) {
      const db = getDb();
      models = db.prepare('SELECT platform, model_id, display_name FROM models WHERE enabled = 1 ORDER BY intelligence_rank').all() as any[];
    } else {
      const dbModels = await Model.find({ enabled: true }).sort({ intelligenceRank: 1 });
      models = dbModels.map(m => ({
        platform: m.platform,
        model_id: m.modelId,
        display_name: m.displayName
      }));
    }

    return res.json({
      models: [
        {
          name: `models/${AUTO_MODEL_ID}`,
          displayName: 'Auto (router picks the best available model)',
          supportedGenerationMethods: ['generateContent', 'streamGenerateContent']
        },
        ...models.map(m => ({
          name: `models/${m.model_id}`,
          displayName: m.display_name,
          supportedGenerationMethods: ['generateContent', 'streamGenerateContent']
        }))
      ]
    });
  } catch (err) {
    next(err);
  }
});

// Gemini-compatible Single Model Detail API
geminiProxyRouter.get('/models/*model', async (req: Request, res: Response, next) => {
  try {
    const rawParam = req.params.model;
    const modelParam = Array.isArray(rawParam) ? rawParam.join('/') : (rawParam as string || '');
    let modelId = modelParam;
    if (modelParam.endsWith(':generateContent')) {
      modelId = modelParam.slice(0, -':generateContent'.length);
    } else if (modelParam.endsWith(':streamGenerateContent')) {
      modelId = modelParam.slice(0, -':streamGenerateContent'.length);
    }
    if (modelId.startsWith('models/')) {
      modelId = modelId.replace(/^models\//, '');
    }

    let model: any = null;
    if (isLocalDbEnabled()) {
      const db = getDb();
      model = db.prepare('SELECT platform, model_id, display_name FROM models WHERE model_id = ? AND enabled = 1').get(modelId);
    } else {
      model = await Model.findOne({ modelId, enabled: true });
    }

    if (!model && modelId !== AUTO_MODEL_ID) {
      return res.status(404).json({
        error: {
          code: 404,
          message: `Model '${modelId}' not found or is disabled.`,
          status: 'NOT_FOUND'
        }
      });
    }

    return res.json({
      name: `models/${modelId}`,
      displayName: modelId === AUTO_MODEL_ID ? 'Auto' : (model.display_name || model.displayName),
      supportedGenerationMethods: ['generateContent', 'streamGenerateContent']
    });
  } catch (err) {
    next(err);
  }
});

// Gemini-compatible generateContent / streamGenerateContent Route
geminiProxyRouter.post('/models/*model', async (req: Request, res: Response) => {
  const start = Date.now();
  let userId = 'local-dev-user-uid';
  
  // Extract token from query params key OR goog header OR Bearer auth header
  const token = (req.query.key as string) || (req.headers['x-goog-api-key'] as string) || req.headers.authorization?.replace(/^Bearer\s+/i, '');

  if (!token) {
    return res.status(401).json({
      error: {
        code: 401,
        message: 'API key not found',
        status: 'UNAUTHENTICATED'
      }
    });
  }

  let isLocal = !process.env.MONGODB_URI;
  let authenticated = false;

  // 1. Check cloud database (if URI present)
  if (process.env.MONGODB_URI) {
    try {
      const projKey = await ProjectKey.findOne({ projectKey: token, enabled: true });
      if (projKey) {
        userId = projKey.userId;
        isLocal = false;
        authenticated = true;
        (req as any).projectKey = projKey.projectKey;
      } else {
        if (token.startsWith('omnikey-g-')) {
          const settings = await UserSettings.findOne({ unifiedGeminiApiKey: token });
          if (settings) {
            userId = settings.userId;
            isLocal = false;
            authenticated = true;
            const promoted = await ProjectKey.findOne({ projectKey: token, userId: settings.userId, enabled: true });
            if (promoted) (req as any).projectKey = promoted.projectKey;
          }
        } else if (token.startsWith('omnikey-')) {
          const settings = await UserSettings.findOne({ unifiedApiKey: token });
          if (settings) {
            userId = settings.userId;
            isLocal = false;
            authenticated = true;
            const promoted = await ProjectKey.findOne({ projectKey: token, userId: settings.userId, enabled: true });
            if (promoted) (req as any).projectKey = promoted.projectKey;
          }
        }
      }
    } catch (e) {
      console.warn('[Gemini Proxy] Failed to query MongoDB key:', e);
    }
  }

  // 2. Fall back to local SQLite
  if (!authenticated) {
    try {
      const db = getDb();
      const projRow = db.prepare("SELECT * FROM project_keys WHERE project_key = ? AND enabled = 1").get(token) as any;
      if (projRow) {
        isLocal = true;
        authenticated = true;
        (req as any).projectKey = projRow.project_key;
      } else {
        if (token.startsWith('omnikey-g-')) {
          const unifiedGeminiKey = getUnifiedGeminiApiKey();
          if (timingSafeStringEqual(token, unifiedGeminiKey)) {
            isLocal = true;
            authenticated = true;
            const promoted = db.prepare("SELECT * FROM project_keys WHERE project_key = ? AND enabled = 1").get(token) as any;
            if (promoted) (req as any).projectKey = promoted.project_key;
          }
        } else if (token.startsWith('omnikey-')) {
          const unifiedKey = getUnifiedApiKey();
          if (timingSafeStringEqual(token, unifiedKey)) {
            isLocal = true;
            authenticated = true;
            const promoted = db.prepare("SELECT * FROM project_keys WHERE project_key = ? AND enabled = 1").get(token) as any;
            if (promoted) (req as any).projectKey = promoted.project_key;
          }
        }
      }
    } catch (e) {
      console.warn('[Gemini Proxy] Failed to query SQLite key:', e);
    }
  }

  if (!authenticated) {
    return res.status(401).json({
      error: {
        code: 401,
        message: 'Invalid API key',
        status: 'UNAUTHENTICATED'
      }
    });
  }

  // Wrap inside DB context
  await dbModeStorage.run(isLocal ? 'local' : 'cloud', async () => {
    const parsed = translateGeminiRequest(req.body);
    if (parsed.messages.length === 0) {
      return res.status(400).json({
        error: {
          code: 400,
          message: 'Invalid request: no content parts found',
          status: 'INVALID_ARGUMENT'
        }
      });
    }

    const { messages, temperature, max_tokens, top_p, responseModalities, speechConfig } = parsed;
    
    const rawParam = req.params.model;
    const modelParam = Array.isArray(rawParam) ? rawParam.join('/') : (rawParam as string || '');
    let modelId = modelParam;
    let method = 'generateContent';
    
    if (modelParam.endsWith(':generateContent')) {
      modelId = modelParam.slice(0, -':generateContent'.length);
      method = 'generateContent';
    } else if (modelParam.endsWith(':streamGenerateContent')) {
      modelId = modelParam.slice(0, -':streamGenerateContent'.length);
      method = 'streamGenerateContent';
    }
    
    const isStream = method === 'streamGenerateContent';

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

    if (modelId && modelId.startsWith('models/')) {
      modelId = modelId.replace(/^models\//, '');
    }

    if (modelId && modelId !== AUTO_MODEL_ID && (modelId === 'groq/compound-mini' || modelId.includes('groq-mini'))) {
      if (estimatedInputTokens > 7500) {
        const contentText = 'The model you selected only supports 8192 tokens and the input token is higher than 8192, please select some other model';
        
        logRequest(
          'groq', 'groq/compound-mini', 'success',
          estimatedInputTokens, 0,
          Date.now() - start, null, userId,
          undefined, (req as any).projectKey
        );

        if (isStream) {
          const useSSE = req.query.alt === 'sse';
          const geminiChunk = {
            candidates: [
              {
                content: {
                  parts: [{ text: contentText }],
                  role: 'model'
                },
                finishReason: 'STOP',
                index: 0
              }
            ],
            usageMetadata: {
              promptTokenCount: estimatedInputTokens,
              candidatesTokenCount: 0,
              totalTokenCount: estimatedInputTokens
            },
            modelVersion: modelId
          };

          if (useSSE) {
            res.setHeader('Content-Type', 'text/event-stream');
            res.setHeader('Cache-Control', 'no-cache');
            res.setHeader('Connection', 'keep-alive');
            res.write(`data: ${JSON.stringify(geminiChunk)}\n\n`);
          } else {
            res.setHeader('Content-Type', 'application/json');
            res.write('[\n');
            res.write(JSON.stringify(geminiChunk));
            res.write('\n]\n');
          }
          res.end();
          return;
        } else {
          return res.json({
            candidates: [
              {
                content: {
                  parts: [{ text: contentText }],
                  role: 'model'
                },
                finishReason: 'STOP',
                index: 0
              }
            ],
            usageMetadata: {
              promptTokenCount: estimatedInputTokens,
              candidatesTokenCount: 0,
              totalTokenCount: estimatedInputTokens
            },
            modelVersion: modelId
          });
        }
      }
    }

    let requiredModality = req.headers['x-required-modality'] as string | undefined;

    // Detect dynamic multimodal content in parts (e.g. inlineData) if header not present
    if (!requiredModality && req.body && Array.isArray(req.body.contents)) {
      for (const content of req.body.contents) {
        if (Array.isArray(content.parts)) {
          for (const part of content.parts) {
            if (part.inlineData) {
              const mime = String(part.inlineData.mimeType || '');
              if (mime.startsWith('audio/')) {
                requiredModality = 'audio_input';
              } else {
                requiredModality = 'vision';
              }
              break;
            }
          }
        }
        if (requiredModality) break;
      }
    }

    if (!requiredModality && responseModalities && responseModalities.includes('AUDIO')) {
      requiredModality = 'audio_output';
    }

    let preferredModel: number | string | undefined;
    if (modelId === AUTO_MODEL_ID) {
      if (requiredModality === 'audio_output') {
        const audioModelId = 'gemini-2.5-flash';
        if (isLocalDbEnabled()) {
          const db = getDb();
          const enabled = db.prepare('SELECT id FROM models WHERE model_id = ? AND enabled = 1').get(audioModelId) as { id: number } | undefined;
          if (enabled) preferredModel = enabled.id;
        } else {
          const enabled = await Model.findOne({ modelId: audioModelId, enabled: true });
          if (enabled) preferredModel = enabled._id.toString();
        }
      } else {
        preferredModel = undefined;
      }
    } else if (modelId) {
      if (isLocalDbEnabled()) {
        const db = getDb();
        const enabled = db.prepare('SELECT id FROM models WHERE model_id = ? AND enabled = 1').get(modelId) as { id: number } | undefined;
        if (enabled) {
          preferredModel = enabled.id;
        } else {
          const disabled = db.prepare('SELECT id FROM models WHERE model_id = ?').get(modelId) as { id: number } | undefined;
          const reason = disabled ? 'is disabled' : 'is not in the catalog';
          return res.status(400).json({
            error: {
              code: 400,
              message: `Model '${modelId}' ${reason}.`,
              status: 'INVALID_ARGUMENT'
            }
          });
        }
      } else {
        const enabled = await Model.findOne({ modelId, enabled: true });
        if (enabled) {
          preferredModel = enabled._id.toString();
        } else {
          const disabled = await Model.findOne({ modelId });
          const reason = disabled ? 'is disabled' : 'is not in the catalog';
          return res.status(400).json({
            error: {
              code: 400,
              message: `Model '${modelId}' ${reason}.`,
              status: 'INVALID_ARGUMENT'
            }
          });
        }
      }
    }

    const MAX_RETRIES = 20;
    const skipKeys = new Set<string>();
    let lastError: any = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      let route: RouteResult;
      try {
        route = await routeRequest(estimatedTotal, skipKeys.size > 0 ? skipKeys : undefined, preferredModel, userId, requiredModality, estimatedInputTokens);
      } catch (err: any) {
        if (lastError) {
          return res.status(429).json({
            error: {
              code: 429,
              message: `All models rate-limited. Last error: ${lastError.message}`,
              status: 'RESOURCE_EXHAUSTED'
            }
          });
        } else {
          return res.status(err.status ?? 503).json({
            error: {
              code: err.status ?? 503,
              message: err.message,
              status: 'UNAVAILABLE'
            }
          });
        }
      }

      recordRequest(route.platform, route.modelId, route.keyId as any);

      try {
        if (!isStream) {
          const result = await route.provider.chatCompletion(
            route.apiKey, messages, route.modelId,
            { temperature, max_tokens, top_p, responseModalities, speechConfig },
          );

          const totalTokens = result.usage?.total_tokens ?? 0;
          recordTokens(route.platform, route.modelId, route.keyId as any, totalTokens);
          recordSuccess(route.modelDbId);

          const keyUsed = (route.keyLabel && route.keyLabel.trim()) ? route.keyLabel.trim() : `Key #${route.keyId}`;
          if (route.isPromo) {
            res.setHeader('X-Routed-Via', 'Promo Model');
            res.setHeader('X-Key-Used', 'OmniKey Funded Key');
          } else {
            res.setHeader('X-Routed-Via', `${route.platform}/${route.modelId}`);
            res.setHeader('X-Key-Used', keyUsed);
          }
          if (attempt > 0) res.setHeader('X-Fallback-Attempts', String(attempt));

          const geminiResponse = translateToGeminiResponse(result, modelId as string);
          if (geminiResponse && typeof geminiResponse === 'object') {
            if (route.isPromo) {
              geminiResponse.modelVersion = 'omnikey-promo';
              geminiResponse._routed_via = {
                platform: 'Promo Pool',
                model: 'Promo Model',
                keyUsed: 'OmniKey Funded Key',
              };
            } else {
              geminiResponse._routed_via = {
                platform: route.platform,
                model: route.modelId,
                keyUsed,
              };
            }
          }

          res.json(geminiResponse);

          logRequest(
            route.platform, route.modelId, 'success',
            result.usage?.prompt_tokens ?? 0,
            result.usage?.completion_tokens ?? 0,
            Date.now() - start, null, userId,
            route.isPromo ? route.fundedByUserId : undefined,
            (req as any).projectKey
          );
          return;
        } else {
          let totalOutputTokens = 0;
          let streamStarted = false;
          const useSSE = req.query.alt === 'sse';
          try {
            const gen = route.provider.streamChatCompletion(
              route.apiKey, messages, route.modelId,
              { temperature, max_tokens, top_p, responseModalities, speechConfig },
            );

            let isFirstChunk = true;

            for await (const chunk of gen) {
              if (!streamStarted) {
                const keyUsed = (route.keyLabel && route.keyLabel.trim()) ? route.keyLabel.trim() : `Key #${route.keyId}`;
                if (route.isPromo) {
                  res.setHeader('X-Routed-Via', 'Promo Model');
                  res.setHeader('X-Key-Used', 'OmniKey Funded Key');
                } else {
                  res.setHeader('X-Routed-Via', `${route.platform}/${route.modelId}`);
                  res.setHeader('X-Key-Used', keyUsed);
                }
                if (attempt > 0) res.setHeader('X-Fallback-Attempts', String(attempt));
                
                if (useSSE) {
                  res.setHeader('Content-Type', 'text/event-stream');
                  res.setHeader('Cache-Control', 'no-cache');
                  res.setHeader('Connection', 'keep-alive');
                } else {
                  res.setHeader('Content-Type', 'application/json');
                  res.write('[\n');
                }
                streamStarted = true;
              }

              const text = chunk.choices[0]?.delta?.content ?? '';
              totalOutputTokens += Math.ceil(text.length / 4);

              if (route.isPromo && chunk && typeof chunk === 'object') {
                chunk.model = 'omnikey-promo';
              }
              const geminiChunk = translateToGeminiStreamChunk(chunk);
              
              if (useSSE) {
                res.write(`data: ${JSON.stringify(geminiChunk)}\n\n`);
              } else {
                if (!isFirstChunk) {
                  res.write(',\n');
                }
                res.write(JSON.stringify(geminiChunk));
                isFirstChunk = false;
              }
            }

            if (!streamStarted) {
              const keyUsed = (route.keyLabel && route.keyLabel.trim()) ? route.keyLabel.trim() : `Key #${route.keyId}`;
              if (route.isPromo) {
                res.setHeader('X-Routed-Via', 'Promo Model');
                res.setHeader('X-Key-Used', 'OmniKey Funded Key');
              } else {
                res.setHeader('X-Routed-Via', `${route.platform}/${route.modelId}`);
                res.setHeader('X-Key-Used', keyUsed);
              }
              if (useSSE) {
                res.setHeader('Content-Type', 'text/event-stream');
              } else {
                res.setHeader('Content-Type', 'application/json');
                res.write('[\n');
              }
            }

            if (!useSSE) {
              res.write('\n]\n');
            }
            res.end();

            recordTokens(route.platform, route.modelId, route.keyId as any, estimatedInputTokens + totalOutputTokens);
            recordSuccess(route.modelDbId);
            logRequest(route.platform, route.modelId, 'success', estimatedInputTokens, totalOutputTokens, Date.now() - start, null, userId, route.isPromo ? route.fundedByUserId : undefined, (req as any).projectKey);
            return;
          } catch (streamErr: any) {
            if (streamStarted) {
              console.error(`[Gemini Proxy] Mid-stream error from ${route.displayName}:`, streamErr.message);
              if (useSSE) {
                const payload = { error: { message: `Provider error (${route.displayName}): stream interrupted`, code: 500, status: 'INTERNAL' } };
                try { res.write(`data: ${JSON.stringify(payload)}\n\n`); } catch {}
              } else {
                const payload = { error: { message: `Provider error (${route.displayName}): stream interrupted`, code: 500, status: 'INTERNAL' } };
                try { res.write(`, \n${JSON.stringify(payload)}\n]\n`); } catch {}
              }
              try { res.end(); } catch {}
              logRequest(route.platform, route.modelId, 'error', estimatedInputTokens, totalOutputTokens, Date.now() - start, streamErr.message, userId, route.isPromo ? route.fundedByUserId : undefined, (req as any).projectKey);
              return;
            }
            throw streamErr;
          }
        }
      } catch (err: any) {
        const latency = Date.now() - start;

        if (isRetryableError(err) && attempt < MAX_RETRIES - 1) {
          logRequest(route!.platform, route!.modelId, 'fallback', estimatedInputTokens, 0, latency, err.message, userId, route!.isPromo ? route!.fundedByUserId : undefined, (req as any).projectKey);
          const skipId = `${route!.platform}:${route!.modelId}:${route!.keyId}`;
          skipKeys.add(skipId);
          setCooldown(route!.platform, route!.modelId, route!.keyId as any, 120_000);
          recordRateLimitHit(route!.modelDbId);
          lastError = err;
          console.log(`[Gemini Proxy] ${err.message.slice(0, 60)} from ${route!.displayName}, falling back (attempt ${attempt + 1}/${MAX_RETRIES})`);
          continue;
        }

        logRequest(route!.platform, route!.modelId, 'error', estimatedInputTokens, 0, latency, err.message, userId, route!.isPromo ? route!.fundedByUserId : undefined, (req as any).projectKey);
        return res.status(502).json({
          error: {
            code: 502,
            message: `Provider error (${route!.displayName}): ${err.message}`,
            status: 'INTERNAL'
          }
        });
      }
    }

    return res.status(429).json({
      error: {
        code: 429,
        message: `All models rate-limited after ${MAX_RETRIES} attempts. Last: ${lastError?.message}`,
        status: 'RESOURCE_EXHAUSTED'
      }
    });
  });
});
