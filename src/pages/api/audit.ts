import { NextApiRequest, NextApiResponse } from 'next';
import path from 'path';
import { LighthouseService } from '@/lib/lighthouse';
import { LighthouseConfig, AuditResult } from '@/types';

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

    // Validate URLs
    const validUrls = urls.filter(url => {
      try {
        new URL(url);
        return true;
      } catch {
        return false;
      }
    });

    if (validUrls.length === 0) {
      return res.status(400).json({ error: 'No valid URLs provided' });
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

// Clean up old sessions periodically (in production, use a proper job queue)
setInterval(() => {
  const cutoff = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago
  Array.from(auditSessions.entries()).forEach(([sessionId, session]) => {
    const sessionTime = parseInt(sessionId, 36);
    if (sessionTime < cutoff) {
      auditSessions.delete(sessionId);
    }
  });
}, 60 * 60 * 1000); // Clean up every hour