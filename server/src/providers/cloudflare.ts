import type {
  ChatMessage,
  ChatCompletionResponse,
  ChatCompletionChunk,
} from '@omnikey-ai/shared/types.js';
import { BaseProvider, type CompletionOptions } from './base.js';
import { contentToString } from '../lib/content.js';

/**
 * Cloudflare Workers AI provider.
 * API key format expected: "account_id:api_token"
 * The account_id is extracted from the key to build the URL.
 */
export class CloudflareProvider extends BaseProvider {
  readonly platform = 'cloudflare' as const;
  readonly name = 'Cloudflare Workers AI';

  private parseKey(apiKey: string): { accountId: string; token: string } {
    const sep = apiKey.indexOf(':');
    if (sep === -1) throw new Error('Cloudflare key must be in format "account_id:api_token"');
    return { accountId: apiKey.slice(0, sep), token: apiKey.slice(sep + 1) };
  }

  // Cloudflare's OpenAI-compat endpoint:
  //   - rejects `content: null` on assistant messages that carry tool_calls,
  //     even though the OpenAI spec allows it (collapse to '');
  //   - doesn't accept the array content envelope, so flatten to string.
  private normalizeMessages(messages: ChatMessage[]): ChatMessage[] {
    return messages.map(m => ({ ...m, content: contentToString(m.content) }));
  }

  async chatCompletion(
    apiKey: string,
    messages: ChatMessage[],
    modelId: string,
    options?: CompletionOptions,
  ): Promise<ChatCompletionResponse> {
    const { accountId, token } = this.parseKey(apiKey);
    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1/chat/completions`;

    const res = await this.fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelId,
        messages: this.normalizeMessages(messages),
        temperature: options?.temperature,
        max_tokens: options?.max_tokens,
        top_p: options?.top_p,
        tools: options?.tools,
        tool_choice: options?.tool_choice,
        parallel_tool_calls: options?.parallel_tool_calls,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Cloudflare API error ${res.status}: ${(err as any).error?.message ?? (err as any).errors?.[0]?.message ?? res.statusText}`);
    }

    const data = await res.json() as ChatCompletionResponse;
    data._routed_via = { platform: 'cloudflare', model: modelId };
    return data;
  }

  async *streamChatCompletion(
    apiKey: string,
    messages: ChatMessage[],
    modelId: string,
    options?: CompletionOptions,
  ): AsyncGenerator<ChatCompletionChunk> {
    const { accountId, token } = this.parseKey(apiKey);
    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/v1/chat/completions`;

    const res = await this.fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: modelId,
        messages: this.normalizeMessages(messages),
        temperature: options?.temperature,
        max_tokens: options?.max_tokens,
        top_p: options?.top_p,
        tools: options?.tools,
        tool_choice: options?.tool_choice,
        parallel_tool_calls: options?.parallel_tool_calls,
        stream: true,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Cloudflare API error ${res.status}: ${(err as any).error?.message ?? (err as any).errors?.[0]?.message ?? res.statusText}`);
    }

    const reader = res.body?.getReader();
    if (!reader) throw new Error('No response body');

    const decoder = new TextDecoder();
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || !trimmed.startsWith('data: ')) continue;
        const data = trimmed.slice(6);
        if (data === '[DONE]') return;
        try {
          yield JSON.parse(data) as ChatCompletionChunk;
        } catch {
          // Skip malformed chunks
        }
      }
    }
  }

  async generateImages(
    apiKey: string,
    prompt: string,
    modelId: string,
    options?: { numberOfImages?: number; aspectRatio?: string; outputMimeType?: string }
  ): Promise<{ generatedImages: Array<{ image: { imageBytes: string } }> }> {
    const { accountId, token } = this.parseKey(apiKey);
    
    let cfModelId = modelId;
    const payload: any = { prompt };

    if (!cfModelId.includes('/')) {
      if (cfModelId.includes('flux-1-schnell')) {
        cfModelId = '@cf/black-forest-labs/flux-1-schnell';
        payload.steps = 4;
      } else if (cfModelId.includes('flux-2-dev')) {
        cfModelId = '@cf/black-forest-labs/flux-2-dev';
        payload.steps = 20;
      } else if (cfModelId.includes('flux-2-klein-4b')) {
        cfModelId = '@cf/black-forest-labs/flux-2-klein-4b';
        payload.steps = 4;
      } else if (cfModelId.includes('flux-2-klein-9b')) {
        cfModelId = '@cf/black-forest-labs/flux-2-klein-9b';
        payload.steps = 4;
      } else if (cfModelId.includes('phoenix-1.0')) {
        cfModelId = '@cf/leonardo/phoenix-1.0';
        payload.steps = 20;
      } else if (cfModelId.includes('lucid-origin')) {
        cfModelId = '@cf/leonardo/lucid-origin';
        payload.steps = 20;
      } else if (cfModelId.includes('stable-diffusion-xl-base-1.0')) {
        cfModelId = '@cf/stabilityai/stable-diffusion-xl-base-1.0';
      } else if (cfModelId.includes('dreamshaper-8-lcm')) {
        cfModelId = '@cf/lykon/dreamshaper-8-lcm';
      } else {
        cfModelId = `@cf/black-forest-labs/${cfModelId}`;
        if (cfModelId.includes('flux')) {
          payload.steps = 4;
        }
      }
    } else {
      // If full path is passed, ensure steps are added if missing
      if (cfModelId.includes('flux-1-schnell') || cfModelId.includes('flux-2-klein-4b') || cfModelId.includes('flux-2-klein-9b')) {
        payload.steps = 4;
      } else if (cfModelId.includes('flux-2-dev')) {
        payload.steps = 20;
      }
    }

    const url = `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${cfModelId}`;

    const res = await this.fetchWithTimeout(url, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(`Cloudflare API error ${res.status}: ${(err as any).error?.message ?? (err as any).errors?.[0]?.message ?? res.statusText}`);
    }

    const contentType = res.headers.get('content-type') || '';
    let base64 = '';

    if (contentType.includes('application/json')) {
      const data = await res.json() as any;
      if (data.result?.image) {
        base64 = data.result.image;
      } else if (data.image) {
        base64 = data.image;
      } else {
        throw new Error('Cloudflare API response missing image field');
      }
    } else {
      const buffer = await res.arrayBuffer();
      base64 = Buffer.from(buffer).toString('base64');
    }

    return {
      generatedImages: [
        {
          image: {
            imageBytes: base64,
          },
        },
      ],
    };
  }

  async validateKey(apiKey: string): Promise<boolean> {
    // Transport errors propagate — health.ts marks status='error' without
    // counting toward auto-disable. Only confirmed bad/inactive tokens disable.
    const { token } = this.parseKey(apiKey);
    const res = await this.fetchWithTimeout(
      'https://api.cloudflare.com/client/v4/user/tokens/verify',
      { method: 'GET', headers: { 'Authorization': `Bearer ${token}` } },
      10000,
    );
    if (res.status === 401 || res.status === 403) return false;
    if (!res.ok) return true; // unexpected non-2xx that isn't auth — don't disable
    const data = await res.json() as any;
    return data.success === true && data.result?.status === 'active';
  }
}
