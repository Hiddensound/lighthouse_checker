import { getIronSession, SessionOptions } from 'iron-session';
import type { NextApiRequest, NextApiResponse } from 'next';
import crypto from 'crypto';

/**
 * Operator-password auth — a single shared password gates the whole app for
 * a small trusted team. Sealed iron-session cookie carries the auth flag and
 * a per-cookie ID used for rate-limit bucketing.
 *
 * Required env vars:
 *   OPERATOR_PASSWORD  — the shared password operators type at /login
 *   SESSION_PASSWORD   — at least 32 chars; seals the cookie. Rotating it
 *                        invalidates every active session.
 */

export interface OperatorSession {
  authenticated?: boolean;
  cookieId?: string;
  loggedInAt?: number;
}

const COOKIE_NAME = 'lighthouse-operator';

function getSessionPassword(): string {
  const pw = process.env.SESSION_PASSWORD;
  if (!pw || pw.length < 32) {
    throw new Error(
      'SESSION_PASSWORD env var is required and must be at least 32 characters. ' +
      'Generate one with `openssl rand -hex 32`.'
    );
  }
  return pw;
}

export function getSessionOptions(): SessionOptions {
  return {
    cookieName: COOKIE_NAME,
    password: getSessionPassword(),
    cookieOptions: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax',
      // 7 days
      maxAge: 60 * 60 * 24 * 7
    }
  };
}

export async function getOperatorSession(req: NextApiRequest, res: NextApiResponse) {
  return getIronSession<OperatorSession>(req, res, getSessionOptions());
}

/**
 * Constant-time string comparison to avoid leaking the password length/prefix
 * via response timing.
 */
export function safeEquals(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) return false;
  return crypto.timingSafeEqual(ab, bb);
}

export function getOperatorPassword(): string {
  const pw = process.env.OPERATOR_PASSWORD;
  if (!pw) {
    throw new Error('OPERATOR_PASSWORD env var is required.');
  }
  return pw;
}

/**
 * Gate an API handler. Returns true if the request is authenticated;
 * otherwise writes a 401 response and returns false. The caller should
 * `return` immediately when this returns false.
 */
export async function requireOperator(
  req: NextApiRequest,
  res: NextApiResponse
): Promise<{ ok: true; cookieId: string } | { ok: false }> {
  const session = await getOperatorSession(req, res);
  if (!session.authenticated || !session.cookieId) {
    res.status(401).json({ error: 'Unauthorized' });
    return { ok: false };
  }
  return { ok: true, cookieId: session.cookieId };
}

export function newCookieId(): string {
  return crypto.randomBytes(16).toString('hex');
}
