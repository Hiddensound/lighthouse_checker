import { NextApiRequest, NextApiResponse } from 'next';
import { getRunsForUrl } from '@/lib/db';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const encoded = req.query.encodedUrl;
  if (typeof encoded !== 'string') {
    return res.status(400).json({ error: 'URL is required' });
  }

  let url: string;
  try {
    url = decodeURIComponent(encoded);
    new URL(url);
  } catch {
    return res.status(400).json({ error: 'Invalid URL' });
  }

  const formFactor = (req.query.formFactor as string) || 'desktop';
  if (formFactor !== 'desktop' && formFactor !== 'mobile') {
    return res.status(400).json({ error: 'formFactor must be desktop or mobile' });
  }

  try {
    const runs = getRunsForUrl(url, formFactor);
    return res.status(200).json({ url, formFactor, runs });
  } catch (error) {
    console.error('History detail error:', error);
    return res.status(500).json({ error: 'Failed to load history' });
  }
}
