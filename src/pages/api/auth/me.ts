import type { NextApiRequest, NextApiResponse } from 'next';
import { getOperatorSession } from '@/lib/auth';

/**
 * Lightweight endpoint the frontend uses to ask "am I authenticated?".
 * Used by `_app.tsx` to redirect to /login on first load.
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const session = await getOperatorSession(req, res);
  return res.status(200).json({ authenticated: !!session.authenticated });
}
