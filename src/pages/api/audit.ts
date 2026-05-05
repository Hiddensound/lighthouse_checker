import { NextApiRequest, NextApiResponse } from 'next';
import path from 'path';
import fs from 'fs/promises';
import dns from 'dns/promises';
import net from 'net';
import { LighthouseService } from '@/lib/lighthouse';
import { LighthouseConfig, AuditResult } from '@/types';
import { isPublicHttpUrl, dedupeUrls, MAX_URLS_PER_AUDIT } from '@/lib/utils';

// Store for tracking audit progress (in production, use Redis or database)
const auditSessions = new Map<string, {
  status: 'processing' | 'completed' | 'error';
  results: AuditResult[];
  currentUrl?: string;
  progress: number;
  total: number;
  error?: string;
  insightsFile?: string; // Path to AI insights file
}>();

/**
 * Generate unique session ID
 */
function generateSessionId(): string {
  return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

/**
 * Reject IPs in private/loopback/link-local ranges. Defends against DNS-based SSRF
 * where a public hostname resolves to an internal address.
 */
function isPrivateAddress(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 169 && b === 254) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 192 && b === 168) return true;
    if (a >= 224) return true;
    return false;
  }
  if (net.isIPv6(ip)) {
    const v = ip.toLowerCase();
    if (v === '::1' || v === '::') return true;
    if (v.startsWith('fc') || v.startsWith('fd') || v.startsWith('fe80')) return true;
    return false;
  }
  return true; // unknown family — fail closed
}

async function resolvesToPublicAddress(url: string): Promise<boolean> {
  try {
    const host = new URL(url).hostname;
    const records = await dns.lookup(host, { all: true });
    if (records.length === 0) return false;
    return records.every(r => !isPrivateAddress(r.address));
  } catch {
    return false;
  }
}

/**
 * Main audit API endpoint
 */
export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    return await handleAuditRequest(req, res);
  } else if (req.method === 'GET') {
    return await handleStatusRequest(req, res);
  } else {
    return res.status(405).json({ error: 'Method not allowed' });
  }
}

/**
 * Handle audit request
 */
async function handleAuditRequest(req: NextApiRequest, res: NextApiResponse) {
  try {
    // Check if we're running in a serverless environment with limited resources
    const isServerless = process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME;
    
    if (isServerless) {
      return res.status(501).json({ 
        error: 'Lighthouse audits are not supported on serverless platforms due to Chrome browser requirements. Please run the application locally for full functionality.',
        suggestion: 'Clone the repository and run "npm run dev" on your local machine for complete Lighthouse functionality.'
      });
    }

    const { urls, config }: { urls: string[], config: LighthouseConfig } = req.body;

    if (!urls || !Array.isArray(urls) || urls.length === 0) {
      return res.status(400).json({ error: 'URLs array is required' });
    }

    if (!config || !config.formFactor) {
      return res.status(400).json({ error: 'Configuration with formFactor is required' });
    }

    // Cap input size so a single request can't queue thousands of audits
    if (urls.length > MAX_URLS_PER_AUDIT) {
      return res.status(400).json({
        error: `Too many URLs. Maximum is ${MAX_URLS_PER_AUDIT} per request.`
      });
    }

    // Hostname-level SSRF check + http(s) protocol check
    const syntacticallySafe = urls.filter(isPublicHttpUrl);

    // DNS-level SSRF check — reject hostnames that resolve to private ranges
    const dnsChecks = await Promise.all(
      syntacticallySafe.map(async (u) => ({ url: u, ok: await resolvesToPublicAddress(u) }))
    );
    const validUrls = dedupeUrls(dnsChecks.filter(r => r.ok).map(r => r.url));

    if (validUrls.length === 0) {
      return res.status(400).json({
        error: 'No valid public URLs provided. Private, loopback, and link-local addresses are not allowed.'
      });
    }

    // Generate session ID
    const sessionId = generateSessionId();
    
    // Initialize session
    auditSessions.set(sessionId, {
      status: 'processing',
      results: [],
      progress: 0,
      total: validUrls.length
    });

    // Start audit process asynchronously
    processAuditAsync(sessionId, validUrls, config);

    return res.status(200).json({
      success: true,
      sessionId,
      message: 'Audit started successfully'
    });

  } catch (error) {
    console.error('Audit request error:', error);
    return res.status(500).json({ error: 'Internal server error' });
  }
}

/**
 * Handle status request
 */
async function handleStatusRequest(req: NextApiRequest, res: NextApiResponse) {
  const { sessionId } = req.query;

  if (!sessionId || typeof sessionId !== 'string') {
    return res.status(400).json({ error: 'Session ID is required' });
  }

  const session = auditSessions.get(sessionId);
  
  if (!session) {
    return res.status(404).json({ error: 'Session not found' });
  }

  return res.status(200).json(session);
}

/**
 * Process audit asynchronously
 */
async function processAuditAsync(
  sessionId: string, 
  urls: string[], 
  config: LighthouseConfig
) {
  const session = auditSessions.get(sessionId);
  if (!session) return;

  try {
    const lighthouseService = new LighthouseService(config.apiKey);
    const reportsDir = path.join(process.cwd(), 'public', 'reports');
    await fs.mkdir(reportsDir, { recursive: true });

    // Process individual URLs and update progress
    const results: AuditResult[] = [];
    
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      
      // Update session progress
      const currentSession = auditSessions.get(sessionId);
      if (currentSession) {
        currentSession.currentUrl = url;
        currentSession.progress = i;
        auditSessions.set(sessionId, currentSession);
      }
      
      try {
        const result = await lighthouseService.auditUrl(
          url,
          config,
          reportsDir,
          (message) => console.log(`Session ${sessionId}: ${message}`)
        );
        
        // Make report paths relative to public directory for web access
        if (result.reportPaths) {
          const publicReportsDir = path.join(process.cwd(), 'public', 'reports');
          result.reportPaths.json = result.reportPaths.json.replace(publicReportsDir, '/reports');
          result.reportPaths.html = result.reportPaths.html.replace(publicReportsDir, '/reports');
        }
        
        results.push(result);
        
        // Update session with partial results
        const progressSession = auditSessions.get(sessionId);
        if (progressSession) {
          progressSession.results = [...results];
          auditSessions.set(sessionId, progressSession);
        }
        
      } catch (error) {
        console.error(`Error processing ${url}:`, error);
        results.push({
          url,
          error: error instanceof Error ? error.message : 'Unknown error occurred'
        });
      }
    }

    // Generate AI insights if API key is provided
    let insightsFile: string | undefined;
    if (config.apiKey && results.length > 0) {
      try {
        console.log(`Generating AI insights for session ${sessionId}...`);
        const insights = await lighthouseService.generateAIInsights(results, config.formFactor);
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const insightsFilename = `lighthouse-ai-insights-${config.formFactor}-${timestamp}.txt`;
        const insightsPath = path.join(reportsDir, insightsFilename);
        
        await import('fs/promises').then(fs => fs.writeFile(insightsPath, insights));
        insightsFile = `/reports/${insightsFilename}`;
        
        console.log(`AI insights saved: ${insightsPath}`);
        
      } catch (error) {
        console.error('Failed to generate AI insights:', error);
      }
    }

    // Update session with final results
    const finalSession = auditSessions.get(sessionId);
    if (finalSession) {
      finalSession.status = 'completed';
      finalSession.results = results;
      finalSession.currentUrl = undefined;
      finalSession.progress = finalSession.total;
      finalSession.insightsFile = insightsFile;
      auditSessions.set(sessionId, finalSession);
    }

  } catch (error) {
    console.error('Audit processing error:', error);
    const errorSession = auditSessions.get(sessionId);
    if (errorSession) {
      errorSession.status = 'error';
      errorSession.error = error instanceof Error ? error.message : 'Unknown error occurred';
      auditSessions.set(sessionId, errorSession);
    }
  }
}

// Clean up old sessions periodically. Guarded against duplicate registration on
// Next.js hot-reload, which otherwise leaks a new interval per file edit.
declare global {
  // eslint-disable-next-line no-var
  var __auditCleanupStarted: boolean | undefined;
}

if (!global.__auditCleanupStarted) {
  global.__auditCleanupStarted = true;
  setInterval(() => {
    const cutoff = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
    Array.from(auditSessions.entries()).forEach(([sessionId]) => {
      const sessionTime = parseInt(sessionId, 36);
      if (sessionTime < cutoff) {
        auditSessions.delete(sessionId);
      }
    });
  }, 60 * 60 * 1000);
}