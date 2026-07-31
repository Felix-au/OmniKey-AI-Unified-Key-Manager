import { describe, it, expect, vi, beforeEach } from 'vitest';
import { routeRequest } from '../../services/router.js';
import { ProjectKey } from '../../models/ProjectKey.js';
import { PromoUser } from '../../models/PromoUser.js';
import { Model } from '../../models/Model.js';
import { ApiKey } from '../../models/ApiKey.js';

// Mock context to return isLocalDbEnabled = false
vi.mock('../../db/context.js', () => ({
  isLocalDbEnabled: () => false
}));

// Mock Mongoose Models
vi.mock('../../models/ProjectKey.js', () => ({
  ProjectKey: {
    findOne: vi.fn()
  }
}));

vi.mock('../../models/PromoUser.js', () => ({
  PromoUser: {
    findOne: vi.fn()
  }
}));

vi.mock('../../models/Model.js', () => {
  const mockFind = vi.fn().mockReturnValue({
    sort: vi.fn().mockResolvedValue([
      {
        _id: 'mock-model-db-id',
        platform: 'google',
        modelId: 'gemini-1.5-flash',
        display_name: 'Gemini 1.5 Flash',
        enabled: true,
        speedRank: 1,
        intelligenceRank: 2
      }
    ])
  });
  return {
    Model: {
      find: mockFind
    }
  };
});

vi.mock('../../models/ApiKey.js', () => ({
  ApiKey: {
    exists: vi.fn(),
    find: vi.fn()
  }
}));

// Mock admin email and user settings for promo routing
vi.mock('../../models/AdminEmail.js', () => ({
  AdminEmail: {
    find: vi.fn(() => [{ email: 'admin@example.com' }])
  }
}));

vi.mock('../../models/UserSettings.js', () => ({
  UserSettings: {
    find: vi.fn(() => [{ userId: 'admin-uid' }]),
    findOne: vi.fn(() => ({ email: 'admin@example.com' }))
  }
}));

// Mock ratelimit methods
vi.mock('../../services/ratelimit.js', () => ({
  canMakeRequest: () => true,
  canUseTokens: () => true,
  isOnCooldown: () => false
}));

// Mock crypto
vi.mock('../../lib/crypto.js', () => ({
  decrypt: () => 'mocked-key'
}));

describe('Router Permissions Enforcer', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Default setup: Promo user is active, user has no keys, Google text model exists
    (PromoUser.findOne as any).mockResolvedValue({
      userId: 'user-uid',
      email: 'user@example.com',
      tokensUsed: 1000,
      tokensLimit: 10000000
    });

    (ApiKey.exists as any).mockResolvedValue(false);

    (ApiKey.find as any).mockResolvedValue([
      {
        _id: 'mock-admin-key-id',
        userId: 'admin-uid',
        platform: 'google',
        label: 'Admin Google Key',
        enabled: true,
        status: 'healthy',
        encryptedKey: 'enc',
        iv: 'iv',
        authTag: 'tag'
      }
    ]);

    (Model.find as any).mockReturnValue({
      sort: vi.fn().mockResolvedValue([
        {
          _id: 'mock-model-db-id',
          platform: 'google',
          modelId: 'gemini-1.5-flash',
          display_name: 'Gemini 1.5 Flash',
          enabled: true,
          speedRank: 1,
          intelligenceRank: 2
        }
      ])
    });
  });

  it('should allow text requests through the promo pool by default', async () => {
    (ProjectKey.findOne as any).mockResolvedValue(null);

    const result = await routeRequest(100, undefined, undefined, 'user-uid', undefined, undefined, false, 'proj-key-abc');
    expect(result.platform).toBe('google');
    expect(result.modelId).toBe('gemini-1.5-flash');
  });

  it('should throw 403 when trying to access vision without allowVision permission', async () => {
    (ProjectKey.findOne as any).mockResolvedValue({
      projectKey: 'proj-key-abc',
      allowVision: false
    });

    await expect(() =>
      routeRequest(100, undefined, undefined, 'user-uid', 'vision', undefined, false, 'proj-key-abc')
    ).rejects.toThrow(/Vision capabilities are not enabled/);
  });

  it('should allow vision when allowVision is true', async () => {
    (ProjectKey.findOne as any).mockResolvedValue({
      projectKey: 'proj-key-abc',
      allowVision: true
    });

    const result = await routeRequest(100, undefined, undefined, 'user-uid', 'vision', undefined, false, 'proj-key-abc');
    expect(result.platform).toBe('google');
    expect(result.modelId).toBe('gemini-1.5-flash');
  });

  it('should throw 403 when trying to access voice (STT) without allowVoice permission', async () => {
    (ProjectKey.findOne as any).mockResolvedValue({
      projectKey: 'proj-key-abc',
      allowVoice: false
    });

    await expect(() =>
      routeRequest(100, undefined, undefined, 'user-uid', 'audio_input', undefined, false, 'proj-key-abc')
    ).rejects.toThrow(/Voice\/speech-to-text capabilities are not enabled/);
  });

  it('should allow voice (STT) when allowVoice is true', async () => {
    (ProjectKey.findOne as any).mockResolvedValue({
      projectKey: 'proj-key-abc',
      allowVoice: true
    });

    const result = await routeRequest(100, undefined, undefined, 'user-uid', 'audio_input', undefined, false, 'proj-key-abc');
    expect(result.platform).toBe('google');
  });

  it('should throw 403 when trying to access TTS without allowTTS permission', async () => {
    (ProjectKey.findOne as any).mockResolvedValue({
      projectKey: 'proj-key-abc',
      allowTTS: false
    });

    await expect(() =>
      routeRequest(100, undefined, undefined, 'user-uid', 'audio_output', undefined, false, 'proj-key-abc')
    ).rejects.toThrow(/Text-to-speech capabilities are not enabled/);
  });

  it('should allow TTS when allowTTS is true', async () => {
    (ProjectKey.findOne as any).mockResolvedValue({
      projectKey: 'proj-key-abc',
      allowTTS: true
    });

    const result = await routeRequest(100, undefined, undefined, 'user-uid', 'audio_output', undefined, false, 'proj-key-abc');
    expect(result.platform).toBe('google');
  });

  it('should throw 403 when trying to generate images without allowImageGen permission', async () => {
    (ProjectKey.findOne as any).mockResolvedValue({
      projectKey: 'proj-key-abc',
      allowImageGen: false
    });

    (Model.find as any).mockReturnValue({
      sort: vi.fn().mockResolvedValue([
        {
          _id: 'mock-model-db-id',
          platform: 'google',
          modelId: 'flux-1-schnell',
          display_name: 'Flux 1 Schnell',
          enabled: true,
          speedRank: 1,
          intelligenceRank: 2
        }
      ])
    });

    await expect(() =>
      routeRequest(100, undefined, undefined, 'user-uid', undefined, undefined, true, 'proj-key-abc')
    ).rejects.toThrow(/Image generation capabilities are not enabled/);
  });

  it('should allow image generation when allowImageGen is true', async () => {
    (ProjectKey.findOne as any).mockResolvedValue({
      projectKey: 'proj-key-abc',
      allowImageGen: true
    });

    (Model.find as any).mockReturnValue({
      sort: vi.fn().mockResolvedValue([
        {
          _id: 'mock-model-db-id',
          platform: 'google',
          modelId: 'flux-1-schnell',
          display_name: 'Flux 1 Schnell',
          enabled: true,
          speedRank: 1,
          intelligenceRank: 2
        }
      ])
    });

    const result = await routeRequest(100, undefined, undefined, 'user-uid', undefined, undefined, true, 'proj-key-abc');
    expect(result.platform).toBe('google');
    expect(result.modelId).toBe('flux-1-schnell');
  });
});
