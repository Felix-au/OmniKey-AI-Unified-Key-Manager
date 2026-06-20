import admin from 'firebase-admin';
import type { Request, Response, NextFunction } from 'express';
import { UserSettings } from '../models/UserSettings.js';
import { isLocalDbEnabled } from '../db/context.js';

// Initialize Firebase Admin SDK
if (admin.apps.length === 0) {
  const projectId = process.env.FIREBASE_PROJECT_ID || 'omnikey-ai';
  admin.initializeApp({
    projectId: projectId,
  });
  console.log(`Firebase Admin SDK initialized with Project ID: ${projectId}`);
}

export interface AuthenticatedRequest extends Request {
  userId?: string;
  userEmail?: string;
  projectKey?: string;
}

/**
 * Middleware to secure interactive dashboard routes (/api/*).
 * Verifies the incoming Firebase JWT client token.
 */
export async function requireDashboardAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  // If local DB is enabled, bypass auth completely
  if (isLocalDbEnabled()) {
    req.userId = 'local-dev-user-uid';
    req.userEmail = 'local-dev-user@example.com';
    return next();
  }

  // Option to bypass auth check in local dev environments if not configured
  if (!process.env.FIREBASE_PROJECT_ID) {
    req.userId = 'local-dev-user-uid';
    req.userEmail = 'local-dev-user@example.com';
    return next();
  }

  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Access denied. Authorization Bearer token is missing.' });
    return;
  }

  const idToken = authHeader.substring(7); // Extract token

  try {
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    if (decodedToken.email_verified !== true) {
      res.status(403).json({ error: 'Access denied. Your email address has not been verified.' });
      return;
    }
    req.userId = decodedToken.uid;
    req.userEmail = decodedToken.email;
    next();
  } catch (error: any) {
    console.error('Firebase IdToken verification failed:', error.message);
    res.status(401).json({ error: 'Authentication failed. Session expired or token is invalid.' });
    return;
  }
}

/**
 * Middleware to secure direct API proxy routes (/v1/chat/completions).
 * Resolves static omnikey tokens to their associated User UID.
 */
export async function requireProxyAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
) {
  // If local DB is enabled, bypass MongoDB validation (SQLite checks are handled inline in proxy)
  if (isLocalDbEnabled()) {
    req.userId = 'local-dev-user-uid';
    return next();
  }
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Access denied. Bearer token is missing.' });
    return;
  }

  const token = authHeader.substring(7);

  if (!token.startsWith('omnikey-')) {
    res.status(401).json({ error: 'Authentication failed. Token format is invalid.' });
    return;
  }

  try {
    // Look up the unique master API key in user settings
    const settings = await UserSettings.findOne({ unifiedApiKey: token });
    if (!settings) {
      res.status(401).json({ error: 'Access denied. The provided API key is invalid or has been revoked.' });
      return;
    }

    req.userId = settings.userId;
    next();
  } catch (error) {
    console.error('Proxy API key authorization lookup failed:', error);
    res.status(500).json({ error: 'Internal security authentication error occurred.' });
    return;
  }
}
