import type { NextApiRequest, NextApiResponse } from 'next';
import { getOperatorSession } from '@/lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  const session = await getOperatorSession(req, res);
  session.destroy();
  return res.status(200).json({ ok: true });
}
