import type { NextApiRequest, NextApiResponse } from 'next';
import {
  getOperatorSession,
  getOperatorPassword,
  safeEquals,
  newCookieId
} from '@/lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { password } = req.body ?? {};
  if (typeof password !== 'string' || password.length === 0) {
    return res.status(400).json({ error: 'Password is required' });
  }

  let expected: string;
  try {
    expected = getOperatorPassword();
  } catch (e) {
    console.error('Auth misconfigured:', e);
    return res.status(500).json({ error: 'Auth not configured on server' });
  }

  if (!safeEquals(password, expected)) {
    // Same response shape and timing whether the password was wrong or empty.
    return res.status(401).json({ error: 'Invalid password' });
  }

  const session = await getOperatorSession(req, res);
  session.authenticated = true;
  session.cookieId = newCookieId();
  session.loggedInAt = Date.now();
  await session.save();

  return res.status(200).json({ ok: true });
}
