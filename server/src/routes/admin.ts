import { Router } from 'express';
import type { Response, NextFunction, Request } from 'express';
import crypto from 'crypto';
import { getDb } from '../db/index.js';
import { hashPassword } from '../lib/crypto.js';
import { isLocalDbEnabled } from '../db/context.js';
import { AdminUser } from '../models/AdminUser.js';
import { UserSettings } from '../models/UserSettings.js';
import { ApiKey } from '../models/ApiKey.js';
import { RequestLog } from '../models/RequestLog.js';
import { Model } from '../models/Model.js';
import admin from 'firebase-admin';
import { AdminEmail } from '../models/AdminEmail.js';
import { PromoUser } from '../models/PromoUser.js';

export const adminRouter = Router();

// In-memory admin session storage
const ADMIN_SESSIONS = new Set<string>();

/**
 * Middleware to secure admin endpoints.
 * Verifies the admin token from headers.
 */
export function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: { message: 'Unauthorized admin access' } });
    return;
  }
  const token = authHeader.substring(7);
  if (!ADMIN_SESSIONS.has(token)) {
    res.status(401).json({ error: { message: 'Session expired or invalid' } });
    return;
  }
  next();
}

/**
 * POST /api/admin/login
 * Public login endpoint for admin.
 */
adminRouter.post('/login', async (req, res, next) => {
  try {
    const { idToken, username, password } = req.body;

    if (idToken) {
      // Google Sign-In verification (Firebase)
      if (!process.env.FIREBASE_PROJECT_ID && isLocalDbEnabled()) {
        // Fallback for local development if Firebase is not configured
        const token = crypto.randomBytes(32).toString('hex');
        ADMIN_SESSIONS.add(token);
        res.json({ success: true, token });
        return;
      }

      // Verify the ID token via Firebase Admin SDK
      const decodedToken = await admin.auth().verifyIdToken(idToken);
      const email = decodedToken.email;
      if (!email) {
        res.status(403).json({ error: { message: 'Access denied. Email not found in token.' } });
        return;
      }

      let isAllowed = false;
      if (isLocalDbEnabled()) {
        const db = getDb();
        const row = db.prepare('SELECT * FROM admin_emails WHERE LOWER(email) = LOWER(?)').get(email);
        isAllowed = !!row;
      } else {
        const adminEmail = await AdminEmail.findOne({ email: email.toLowerCase() });
        isAllowed = !!adminEmail;
      }

      if (!isAllowed) {
        res.status(403).json({ error: { message: 'Access denied. You are not authorized as an administrator.' } });
        return;
      }

      const token = crypto.randomBytes(32).toString('hex');
      ADMIN_SESSIONS.add(token);
      res.json({ success: true, token });
      return;
    }

    // Username/password login is ONLY allowed in local/offline modes
    const isLocalOrUnconfigured = isLocalDbEnabled() || !process.env.FIREBASE_PROJECT_ID;
    if (!isLocalOrUnconfigured) {
      res.status(400).json({ error: { message: 'Google Sign-In is required in Cloud mode.' } });
      return;
    }

    if (!username || !password) {
      res.status(400).json({ error: { message: 'Username and password required' } });
      return;
    }

    const hashed = hashPassword(password);
    let match = false;

    if (isLocalDbEnabled()) {
      const db = getDb();
      const row = db.prepare('SELECT * FROM admin_users WHERE username = ?').get(username) as any;
      if (row && row.password_hash === hashed) {
        match = true;
      }
    } else {
      const user = await AdminUser.findOne({ username });
      if (user && user.passwordHash === hashed) {
        match = true;
      }
    }

    if (!match) {
      res.status(401).json({ error: { message: 'Invalid admin credentials' } });
      return;
    }

    const token = crypto.randomBytes(32).toString('hex');
    ADMIN_SESSIONS.add(token);
    res.json({ success: true, token });
  } catch (err: any) {
    console.error('Admin login verification failed:', err.message || err);
    res.status(401).json({ error: { message: err.message || 'Authentication failed' } });
  }
});

/**
 * POST /api/admin/change-credentials
 * Secure endpoint to update admin credentials.
 */
adminRouter.post('/change-credentials', requireAdminAuth, async (req, res, next) => {
  try {
    const { newUsername, newPassword } = req.body;
    if (!newUsername || !newPassword) {
      res.status(400).json({ error: { message: 'New username and password required' } });
      return;
    }

    const hashed = hashPassword(newPassword);

    if (isLocalDbEnabled()) {
      const db = getDb();
      db.prepare('DELETE FROM admin_users').run();
      db.prepare('INSERT INTO admin_users (username, password_hash) VALUES (?, ?)').run(newUsername, hashed);
    } else {
      await AdminUser.deleteMany({});
      await AdminUser.create({ username: newUsername, passwordHash: hashed });
    }

    res.json({ success: true, message: 'Admin credentials updated successfully' });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/flush-logs
 * Secure endpoint to clear all request/analytics logs.
 */
adminRouter.post('/flush-logs', requireAdminAuth, async (req, res, next) => {
  try {
    if (isLocalDbEnabled()) {
      const db = getDb();
      db.prepare('DELETE FROM requests').run();
    } else {
      await RequestLog.deleteMany({});
    }
    res.json({ success: true, message: 'All request logs flushed successfully' });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/toggle-model
 * Secure endpoint to update global routing status of a model.
 */
adminRouter.post('/toggle-model', requireAdminAuth, async (req, res, next) => {
  try {
    const { modelId, platform, enabled } = req.body;
    if (!modelId || !platform || enabled === undefined) {
      res.status(400).json({ error: { message: 'Missing modelId, platform or enabled flag' } });
      return;
    }

    const enabledVal = enabled ? 1 : 0;

    if (isLocalDbEnabled()) {
      const db = getDb();
      db.prepare('UPDATE models SET enabled = ? WHERE model_id = ? AND platform = ?')
        .run(enabledVal, modelId, platform);
    } else {
      await Model.updateOne({ modelId, platform }, { $set: { enabled: !!enabled } });
    }

    res.json({ success: true, message: `Model ${modelId} status updated successfully` });
  } catch (err) {
    next(err);
  }
});

/**
 * GET /api/admin/stats
 * Secure endpoint returning high-level system analytics, breakdowns, charts, logs, and toggles.
 */
adminRouter.get('/stats', requireAdminAuth, async (req, res, next) => {
  try {
    let system = {
      totalUsers: 0,
      totalKeys: 0,
      activeKeys: 0,
      totalRequests: 0,
      successRate: 100,
      overallCostSaved: 0,
      averageCostSavedPerRequest: 0,
      averageLatencyMs: 0
    };

    let platformBreakdown: any[] = [];
    let modelBreakdown: any[] = [];
    let timeSeries: any[] = [];
    let usersList: any[] = [];
    let latencyDistribution = { fast: 0, normal: 0, slow: 0, verySlow: 0 };
    let errorBreakdown: Array<{ error: string; count: number }> = [];
    let recentLogs: any[] = [];
    let modelsCatalog: any[] = [];

    if (isLocalDbEnabled()) {
      const db = getDb();

      // SQLite calculations
      const usersCount = 1; // Single-user local-first DB
      const keysCountRow = db.prepare('SELECT COUNT(*) as cnt FROM api_keys').get() as { cnt: number };
      const activeKeysRow = db.prepare('SELECT COUNT(*) as cnt FROM api_keys WHERE enabled = 1 AND status = "healthy"').get() as { cnt: number };
      
      const usageRow = db.prepare(`
        SELECT 
          COUNT(*) as totalRequests, 
          SUM(CASE WHEN status='success' THEN 1 ELSE 0 END) as successfulRequests,
          SUM(input_tokens) as totalInputTokens, 
          SUM(output_tokens) as totalOutputTokens, 
          AVG(latency_ms) as avgLatencyMs 
        FROM requests
      `).get() as any;

      const totalRequests = usageRow?.totalRequests || 0;
      const successfulRequests = usageRow?.successfulRequests || 0;
      const totalInput = usageRow?.totalInputTokens || 0;
      const totalOutput = usageRow?.totalOutputTokens || 0;
      const avgLatency = usageRow?.avgLatencyMs || 0;

      const costSaved = (totalInput * 0.0000025) + (totalOutput * 0.00001);

      system = {
        totalUsers: usersCount,
        totalKeys: keysCountRow.cnt,
        activeKeys: activeKeysRow.cnt,
        totalRequests,
        successRate: totalRequests > 0 ? (successfulRequests / totalRequests) * 100 : 100,
        overallCostSaved: Number(costSaved.toFixed(4)),
        averageCostSavedPerRequest: totalRequests > 0 ? Number((costSaved / totalRequests).toFixed(6)) : 0,
        averageLatencyMs: Math.round(avgLatency)
      };

      // Platform breakdown
      const platforms = db.prepare(`
        SELECT 
          platform as _id, 
          COUNT(*) as totalRequests, 
          SUM(CASE WHEN status='success' THEN 1 ELSE 0 END) as successCount,
          SUM(input_tokens) as inputTokens, 
          SUM(output_tokens) as outputTokens, 
          AVG(latency_ms) as avgLatency 
        FROM requests 
        GROUP BY platform
      `).all() as any[];

      platformBreakdown = platforms.map(p => {
        const pCost = (p.inputTokens * 0.0000025) + (p.outputTokens * 0.00001);
        return {
          platform: p._id,
          totalRequests: p.totalRequests,
          successRate: p.totalRequests > 0 ? (p.successCount / p.totalRequests) * 100 : 100,
          tokensProcessed: p.inputTokens + p.outputTokens,
          avgLatencyMs: Math.round(p.avgLatency),
          costSaved: Number(pCost.toFixed(4))
        };
      });

      // Model breakdown
      const models = db.prepare(`
        SELECT 
          model_id as _id, 
          platform, 
          COUNT(*) as totalRequests 
        FROM requests 
        GROUP BY model_id 
        ORDER BY totalRequests DESC 
        LIMIT 10
      `).all() as any[];

      modelBreakdown = models.map(m => ({
        modelId: m._id,
        platform: m.platform,
        totalRequests: m.totalRequests
      }));

      // Time Series (last 30 days)
      const times = db.prepare(`
        SELECT 
          strftime('%Y-%m-%d', created_at) as _id, 
          COUNT(*) as requests, 
          SUM(CASE WHEN status='success' THEN 1 ELSE 0 END) as success 
        FROM requests 
        GROUP BY _id 
        ORDER BY _id ASC 
        LIMIT 30
      `).all() as any[];

      timeSeries = times.map(t => ({
        date: t._id,
        requests: t.requests,
        successRate: t.requests > 0 ? (t.success / t.requests) * 100 : 100
      }));

      // Latency Distribution
      const latencies = db.prepare(`
        SELECT 
          SUM(CASE WHEN latency_ms < 200 THEN 1 ELSE 0 END) as fast,
          SUM(CASE WHEN latency_ms >= 200 AND latency_ms < 1000 THEN 1 ELSE 0 END) as normal,
          SUM(CASE WHEN latency_ms >= 1000 AND latency_ms < 3000 THEN 1 ELSE 0 END) as slow,
          SUM(CASE WHEN latency_ms >= 3000 THEN 1 ELSE 0 END) as verySlow
        FROM requests
      `).get() as any;

      latencyDistribution = {
        fast: latencies?.fast || 0,
        normal: latencies?.normal || 0,
        slow: latencies?.slow || 0,
        verySlow: latencies?.verySlow || 0
      };

      // Error breakdown
      const errors = db.prepare(`
        SELECT error as errorVal, COUNT(*) as cnt 
        FROM requests 
        WHERE status='error' AND error IS NOT NULL AND error != ''
        GROUP BY errorVal 
        ORDER BY cnt DESC 
        LIMIT 5
      `).all() as any[];

      errorBreakdown = errors.map(e => ({
        error: e.errorVal,
        count: e.cnt
      }));

      // Recent Logs
      const logs = db.prepare(`
        SELECT 
          created_at as createdAt, 
          platform, 
          model_id as modelId, 
          status, 
          latency_ms as latencyMs, 
          input_tokens as inputTokens, 
          output_tokens as outputTokens, 
          error 
        FROM requests 
        ORDER BY id DESC 
        LIMIT 15
      `).all() as any[];

      recentLogs = logs.map(l => ({
        ...l,
        userId: 'local-dev-user-uid',
        userEmail: 'local-dev-user@example.com'
      }));

      // Models Catalog
      const catalog = db.prepare(`
        SELECT 
          platform, 
          model_id as modelId, 
          display_name as displayName, 
          enabled 
        FROM models
      `).all() as any[];

      modelsCatalog = catalog.map(c => ({
        ...c,
        enabled: c.enabled === 1 || c.enabled === true
      }));

      // User list mock
      const localKeys = db.prepare('SELECT COUNT(*) as cnt FROM api_keys').get() as { cnt: number };
      usersList = [{
        userId: 'local-dev-user-uid',
        email: 'local-dev-user@example.com',
        keysCount: localKeys.cnt,
        requestsCount: totalRequests,
        tokensConsumed: totalInput + totalOutput,
        costSaved: Number(costSaved.toFixed(4))
      }];

    } else {
      // MongoDB calculations
      const totalUsers = await UserSettings.countDocuments();
      const totalKeys = await ApiKey.countDocuments();
      const activeKeys = await ApiKey.countDocuments({ enabled: true, status: 'healthy' });

      const requestStats = await RequestLog.aggregate([
        {
          $group: {
            _id: null,
            totalRequests: { $sum: 1 },
            successfulRequests: { $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] } },
            totalInputTokens: { $sum: '$inputTokens' },
            totalOutputTokens: { $sum: '$outputTokens' },
            avgLatencyMs: { $avg: '$latencyMs' }
          }
        }
      ]);

      const globalUsage = requestStats[0] || {
        totalRequests: 0,
        successfulRequests: 0,
        totalInputTokens: 0,
        totalOutputTokens: 0,
        avgLatencyMs: 0
      };

      const totalRequests = globalUsage.totalRequests;
      const costSaved = (globalUsage.totalInputTokens * 0.0000025) + (globalUsage.totalOutputTokens * 0.00001);

      system = {
        totalUsers,
        totalKeys,
        activeKeys,
        totalRequests,
        successRate: totalRequests > 0 ? (globalUsage.successfulRequests / totalRequests) * 100 : 100,
        overallCostSaved: Number(costSaved.toFixed(4)),
        averageCostSavedPerRequest: totalRequests > 0 ? Number((costSaved / totalRequests).toFixed(6)) : 0,
        averageLatencyMs: Math.round(globalUsage.avgLatencyMs)
      };

      // Platform Breakdown
      const platforms = await RequestLog.aggregate([
        {
          $group: {
            _id: '$platform',
            totalRequests: { $sum: 1 },
            successCount: { $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] } },
            inputTokens: { $sum: '$inputTokens' },
            outputTokens: { $sum: '$outputTokens' },
            avgLatency: { $avg: '$latencyMs' }
          }
        }
      ]);

      platformBreakdown = platforms.map(p => {
        const pCost = (p.inputTokens * 0.0000025) + (p.outputTokens * 0.00001);
        return {
          platform: p._id,
          totalRequests: p.totalRequests,
          successRate: p.totalRequests > 0 ? (p.successCount / p.totalRequests) * 100 : 100,
          tokensProcessed: p.inputTokens + p.outputTokens,
          avgLatencyMs: Math.round(p.avgLatency),
          costSaved: Number(pCost.toFixed(4))
        };
      });

      // Model Breakdown
      const models = await RequestLog.aggregate([
        {
          $group: {
            _id: '$modelId',
            platform: { $first: '$platform' },
            totalRequests: { $sum: 1 }
          }
        },
        { $sort: { totalRequests: -1 } },
        { $limit: 10 }
      ]);

      modelBreakdown = models.map(m => ({
        modelId: m._id,
        platform: m.platform,
        totalRequests: m.totalRequests
      }));

      // Time Series
      const times = await RequestLog.aggregate([
        {
          $group: {
            _id: {
              $dateToString: { format: '%Y-%m-%d', date: '$createdAt' }
            },
            requests: { $sum: 1 },
            success: { $sum: { $cond: [{ $eq: ['$status', 'success'] }, 1, 0] } }
          }
        },
        { $sort: { _id: 1 } },
        { $limit: 30 }
      ]);

      timeSeries = times.map(t => ({
        date: t._id,
        requests: t.requests,
        successRate: t.requests > 0 ? (t.success / t.requests) * 100 : 100
      }));

      // Latency Distribution
      const latencyStats = await RequestLog.aggregate([
        {
          $group: {
            _id: null,
            fast: { $sum: { $cond: [{ $lt: ['$latencyMs', 200] }, 1, 0] } },
            normal: { $sum: { $cond: [{ $and: [{ $gte: ['$latencyMs', 200] }, { $lt: ['$latencyMs', 1000] }] }, 1, 0] } },
            slow: { $sum: { $cond: [{ $and: [{ $gte: ['$latencyMs', 1000] }, { $lt: ['$latencyMs', 3000] }] }, 1, 0] } },
            verySlow: { $sum: { $cond: [{ $gte: ['$latencyMs', 3000] }, 1, 0] } }
          }
        }
      ]);
      latencyDistribution = latencyStats[0] || { fast: 0, normal: 0, slow: 0, verySlow: 0 };

      const errList = await RequestLog.aggregate([
        { $match: { status: 'error', error: { $nin: [null, ''] } } },
        { $group: { _id: '$error', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 }
      ]);
      errorBreakdown = errList.map(e => ({
        error: e._id,
        count: e.count
      }));

      // Recent Logs
      const logs = await RequestLog.find()
        .sort({ createdAt: -1 })
        .limit(15)
        .lean();
      const uniqueUserIds = Array.from(new Set(logs.map((l: any) => l.userId).filter(Boolean)));
      const userSettingsList = await UserSettings.find({ userId: { $in: uniqueUserIds } }).lean();
      const emailMap = new Map(userSettingsList.map((u: any) => [u.userId, u.email]));

      recentLogs = logs.map((l: any) => ({
        createdAt: l.createdAt,
        platform: l.platform,
        modelId: l.modelId,
        status: l.status,
        latencyMs: l.latencyMs,
        inputTokens: l.inputTokens,
        outputTokens: l.outputTokens,
        error: l.error,
        userId: l.userId,
        userEmail: emailMap.get(l.userId) || l.userId || 'unknown-user'
      }));

      // Models Catalog
      const catalog = await Model.find({}, { platform: 1, modelId: 1, displayName: 1, enabled: 1 }).lean();
      modelsCatalog = catalog.map((c: any) => ({
        platform: c.platform,
        modelId: c.modelId,
        displayName: c.displayName,
        enabled: !!c.enabled
      }));

      // User List (MongoDB lookup)
      const users = await UserSettings.aggregate([
        {
          $lookup: {
            from: 'apikeys',
            localField: 'userId',
            foreignField: 'userId',
            as: 'keys'
          }
        },
        {
          $lookup: {
            from: 'requestlogs',
            localField: 'userId',
            foreignField: 'userId',
            as: 'logs'
          }
        },
        {
          $project: {
            userId: 1,
            email: 1,
            keysCount: { $size: '$keys' },
            requestsCount: { $size: '$logs' },
            tokensConsumed: {
              $sum: {
                $map: {
                  input: '$logs',
                  as: 'log',
                  in: { $add: ['$$log.inputTokens', '$$log.outputTokens'] }
                }
              }
            },
            costSaved: {
              $sum: {
                $map: {
                  input: '$logs',
                  as: 'log',
                  in: {
                    $add: [
                      { $multiply: ['$$log.inputTokens', 0.0000025] },
                      { $multiply: ['$$log.outputTokens', 0.000010] }
                    ]
                  }
                }
              }
            }
          }
        },
        { $sort: { requestsCount: -1 } }
      ]);

      usersList = users.map(u => ({
        ...u,
        costSaved: Number(u.costSaved.toFixed(4))
      }));
    }

    let adminEmails: { email: string; isFundingProvider: boolean }[] = [];
    let promoUsersList: any[] = [];

    if (isLocalDbEnabled()) {
      const db = getDb();
      const rows = db.prepare('SELECT email, is_funding_provider FROM admin_emails ORDER BY created_at DESC').all() as any[];
      adminEmails = rows.map(r => ({ email: r.email, isFundingProvider: r.is_funding_provider === 1 }));
    } else {
      const rows = await AdminEmail.find().sort({ createdAt: -1 });
      adminEmails = rows.map(r => ({ email: r.email, isFundingProvider: !!r.isFundingProvider }));

      try {
        const promoUsers = await PromoUser.find().lean();
        const promoStats = await RequestLog.aggregate([
          { $match: { fundedByUserId: { $ne: null } } },
          {
            $group: {
              _id: '$userId',
              inputTokens: { $sum: '$inputTokens' },
              outputTokens: { $sum: '$outputTokens' },
              requestsCount: { $sum: 1 }
            }
          }
        ]);
        const promoStatsMap = new Map(promoStats.map(s => [s._id?.toString() || '', s]));

        promoUsersList = promoUsers.map((p: any) => {
          const stats = promoStatsMap.get(p.userId?.toString() || '') || { inputTokens: 0, outputTokens: 0, requestsCount: 0 };
          return {
            userId: p.userId,
            email: p.email,
            tokensUsed: p.tokensUsed,
            tokensLimit: p.tokensLimit,
            createdAt: p.createdAt,
            inputTokens: stats.inputTokens,
            outputTokens: stats.outputTokens,
            requestsCount: stats.requestsCount,
          };
        });
      } catch (err) {
        console.error('Failed to aggregate promo user stats:', err);
      }
    }

    res.json({
      success: true,
      system,
      platformBreakdown,
      modelBreakdown,
      timeSeries,
      latencyDistribution,
      errorBreakdown,
      recentLogs,
      modelsCatalog,
      users: usersList,
      adminEmails,
      promoUsers: promoUsersList,
    });
  } catch (error) {
    next(error);
  }
});

/**
 * GET /api/admin/emails
 * Secure endpoint to get all authorized admin emails.
 */
adminRouter.get('/emails', requireAdminAuth, async (req, res, next) => {
  try {
    let emails: { email: string; isFundingProvider: boolean }[] = [];
    if (isLocalDbEnabled()) {
      const db = getDb();
      const rows = db.prepare('SELECT email, is_funding_provider FROM admin_emails ORDER BY created_at DESC').all() as any[];
      emails = rows.map(r => ({ email: r.email, isFundingProvider: r.is_funding_provider === 1 }));
    } else {
      const rows = await AdminEmail.find().sort({ createdAt: -1 });
      emails = rows.map(r => ({ email: r.email, isFundingProvider: !!r.isFundingProvider }));
    }
    res.json({ success: true, emails });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/emails/toggle-funding
 * Secure endpoint to toggle whether an admin account acts as a promo funding provider.
 */
adminRouter.post('/emails/toggle-funding', requireAdminAuth, async (req, res, next) => {
  try {
    const { email, isFundingProvider } = req.body;
    if (!email || typeof email !== 'string') {
      res.status(400).json({ error: { message: 'Valid email address is required' } });
      return;
    }
    const cleanEmail = email.trim().toLowerCase();

    if (isLocalDbEnabled()) {
      const db = getDb();
      db.prepare('UPDATE admin_emails SET is_funding_provider = ? WHERE LOWER(email) = LOWER(?)')
        .run(isFundingProvider ? 1 : 0, cleanEmail);
    } else {
      await AdminEmail.updateOne(
        { email: cleanEmail },
        { isFundingProvider: !!isFundingProvider }
      );
    }
    res.json({ success: true, message: 'Funding provider status updated successfully' });
  } catch (err) {
    next(err);
  }
});

/**
 * POST /api/admin/emails
 * Secure endpoint to add a new admin email.
 */
adminRouter.post('/emails', requireAdminAuth, async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string') {
      res.status(400).json({ error: { message: 'Valid email address is required' } });
      return;
    }
    const cleanEmail = email.trim().toLowerCase();
    
    if (cleanEmail.length === 0) {
      res.status(400).json({ error: { message: 'Valid email address is required' } });
      return;
    }

    if (isLocalDbEnabled()) {
      const db = getDb();
      db.prepare('INSERT OR IGNORE INTO admin_emails (email) VALUES (?)').run(cleanEmail);
    } else {
      await AdminEmail.findOneAndUpdate(
        { email: cleanEmail },
        { email: cleanEmail },
        { upsert: true, new: true }
      );
    }
    res.json({ success: true, message: 'Admin email added successfully' });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/admin/emails
 * Secure endpoint to remove an admin email.
 */
adminRouter.delete('/emails', requireAdminAuth, async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email || typeof email !== 'string') {
      res.status(400).json({ error: { message: 'Valid email address is required' } });
      return;
    }
    const cleanEmail = email.trim().toLowerCase();

    // Prevent deleting the last admin email to avoid getting locked out
    let totalCount = 0;
    if (isLocalDbEnabled()) {
      const db = getDb();
      const row = db.prepare('SELECT COUNT(*) as count FROM admin_emails').get() as { count: number };
      totalCount = row.count;
    } else {
      totalCount = await AdminEmail.countDocuments();
    }

    if (totalCount <= 1) {
      res.status(400).json({ error: { message: 'Cannot delete the last admin email. At least one admin must exist.' } });
      return;
    }

    if (isLocalDbEnabled()) {
      const db = getDb();
      db.prepare('DELETE FROM admin_emails WHERE LOWER(email) = LOWER(?)').run(cleanEmail);
    } else {
      await AdminEmail.deleteOne({ email: cleanEmail });
    }
    res.json({ success: true, message: 'Admin email removed successfully' });
  } catch (err) {
    next(err);
  }
});
