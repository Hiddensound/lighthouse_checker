import type { NextApiRequest, NextApiResponse } from 'next';
import { requireOperator } from '@/lib/auth';
import { cancelSession } from '@/lib/db';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireOperator(req, res);
  if (!auth.ok) return;

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { sessionId } = req.body ?? {};
  if (typeof sessionId !== 'string' || sessionId.length === 0) {
    return res.status(400).json({ error: 'sessionId is required' });
  }

  // Flip the row; the audit loop will exit at the next URL boundary.
  const cancelled = cancelSession(sessionId);
  if (!cancelled) {
    return res.status(409).json({ error: 'Session is not currently processing' });
  }
  return res.status(200).json({ ok: true });
}
