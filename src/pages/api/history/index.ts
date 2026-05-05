import { NextApiRequest, NextApiResponse } from 'next';
import { listUrlHistory } from '@/lib/db';
import { requireOperator } from '@/lib/auth';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const auth = await requireOperator(req, res);
  if (!auth.ok) return;

  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const formFactor = (req.query.formFactor as string) || 'desktop';
  if (formFactor !== 'desktop' && formFactor !== 'mobile') {
    return res.status(400).json({ error: 'formFactor must be desktop or mobile' });
  }

  try {
    const entries = listUrlHistory(formFactor);
    return res.status(200).json({ entries });
  } catch (error) {
    console.error('History list error:', error);
    return res.status(500).json({ error: 'Failed to load history' });
  }
}
