import puppeteer from 'puppeteer';
import lighthouse from 'lighthouse';
import * as chromeLauncher from 'chrome-launcher';
import fs from 'fs/promises';
import path from 'path';
import OpenAI from 'openai/index.mjs';
import { generateTimestamp, createUrlSlug } from './utils';
import { AuditResult, LighthouseConfig } from '@/types';

/**
 * Lighthouse audit service that adapts the original scripts for web app usage
 */
export class LighthouseService {
  private openai: OpenAI | null = null;

  constructor(apiKey?: string) {
    if (apiKey) {
      this.openai = new OpenAI({ apiKey });
    }
  }

  /**
   * Run Lighthouse audit on a single URL
   */
  async auditUrl(
    url: string, 
    config: LighthouseConfig, 
    reportsDir: string,
    onProgress?: (message: string) => void
  ): Promise<AuditResult> {
    const urlSlug = createUrlSlug(url);
    const timestamp = generateTimestamp();
    const deviceSuffix = config.formFactor === 'mobile' ? '-mobile' : '';
    const filenameBase = `${urlSlug}${deviceSuffix}-${timestamp}`;
    const jsonOutputPath = path.join(reportsDir, `${filenameBase}.json`);
    const htmlOutputPath = path.join(reportsDir, `${filenameBase}.html`);

    onProgress?.(` Processing ${config.formFactor} audit for: ${url}`);

    let chrome: any = null;
    let browser: any = null;

    try {
      // Launch Chrome with Vercel-compatible flags
      chrome = await chromeLauncher.launch({
        chromeFlags: [
          '--headless',
          '--disable-gpu',
          '--no-sandbox',
          '--disable-dev-shm-usage',
          '--disable-setuid-sandbox',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-background-timer-throttling',
          '--disable-backgrounding-occluded-windows',
          '--disable-renderer-backgrounding'
        ],
        // Use system Chrome on Vercel
        chromePath: process.env.PUPPETEER_EXECUTABLE_PATH || undefined
      });

      // Connect Puppeteer to Chrome
      browser = await puppeteer.connect({
        browserURL: `http://localhost:${chrome.port}`
      });

      const page = await browser.newPage();
      
      // Set viewport based on form factor
      if (config.formFactor === 'mobile') {
        await page.setViewport({ width: 375, height: 812, isMobile: true });
      } else {
        await page.setViewport({ width: 1350, height: 940 });
      }

      // Set headers if bypass token is provided
      if (config.bypassToken) {
        await page.setExtraHTTPHeaders({
          'x-vercel-protection-bypass': config.bypassToken
        });
      }

      // Load page with robust error handling
      onProgress?.(`Loading page: ${url}`);
      try {
        await page.goto(url, { 
          waitUntil: 'domcontentloaded',
          timeout: 45000 
        });
        
        // Wait for dynamic content
        await new Promise(resolve => setTimeout(resolve, 2000));
        onProgress?.(`Successfully loaded: ${url}`);
      } catch (loadError) {
        const errorMessage = loadError instanceof Error ? loadError.message : String(loadError);
        onProgress?.(`Page load had issues, continuing with Lighthouse: ${errorMessage}`);
      }

      // Configure Lighthouse based on form factor
      const lighthouseConfig = this.getLighthouseConfig(config, chrome.port);
      
      onProgress?.(`Running Lighthouse ${config.formFactor} audit...`);
      const result = await lighthouse(url, lighthouseConfig);
      
      if (!result) {
        throw new Error('Lighthouse returned no result');
      }
      
      const { lhr, report } = result;

      // Calculate scores
      const scores = {
        performance: Math.round((lhr.categories.performance?.score || 0) * 100),
        accessibility: Math.round((lhr.categories.accessibility?.score || 0) * 100),
        'best-practices': Math.round((lhr.categories['best-practices']?.score || 0) * 100),
        seo: Math.round((lhr.categories.seo?.score || 0) * 100),
        pwa: lhr.categories.pwa?.score !== undefined && lhr.categories.pwa?.score !== null 
          ? Math.round(lhr.categories.pwa.score * 100) 
          : 'N/A' as const
      };

      // Save reports
      await fs.writeFile(jsonOutputPath, JSON.stringify(lhr, null, 2));
      await fs.writeFile(htmlOutputPath, report[1] as string);
      onProgress?.(`Reports saved for ${url}`);

      // Extract opportunities
      const opportunities = Object.values(lhr.audits)
        .filter((audit: any) => audit.details && audit.details.type === 'opportunity')
        .sort((a: any, b: any) => (b.numericValue || 0) - (a.numericValue || 0))
        .map((opportunity: any) => ({
          title: opportunity.title,
          displayValue: opportunity.displayValue,
          numericValue: opportunity.numericValue
        }));

      return {
        url,
        scores,
        opportunities,
        reportPaths: {
          json: jsonOutputPath,
          html: htmlOutputPath
        }
      };

    } catch (error) {
      console.error(`Error processing ${url}:`, error);
      
      // Provide more specific error messages for common Vercel issues
      let errorMessage = 'Unknown error occurred';
      if (error instanceof Error) {
        if (error.message.includes('chrome') || error.message.includes('Chrome')) {
          errorMessage = 'Chrome browser not available in serverless environment. Please try running locally.';
        } else if (error.message.includes('timeout')) {
          errorMessage = 'Request timeout - the audit took too long to complete.';
        } else if (error.message.includes('ECONNREFUSED')) {
          errorMessage = 'Connection refused - unable to connect to the target website.';
        } else {
          errorMessage = error.message;
        }
      }
      
      return {
        url,
        error: errorMessage
      };
    } finally {
      if (browser) await browser.disconnect();
      if (chrome) await chrome.kill();
    }
  }

  /**
   * Generate Lighthouse configuration based on form factor
   */
  private getLighthouseConfig(config: LighthouseConfig, port: number) {
    const baseConfig = {
      port,
      output: ['json', 'html'] as ('json' | 'html')[],
      logLevel: 'info' as const,
      maxWaitForLoad: 90000,
      maxWaitForFcp: 30000,
      pauseAfterLoadMs: 1000,
      networkQuietThresholdMs: 1000,
      cpuQuietThresholdMs: 1000,
      blockedUrlPatterns: [],
      skipAudits: [],
      extraHeaders: {} as Record<string, string>
    };

    // Add bypass token if provided
    if (config.bypassToken) {
      baseConfig.extraHeaders['x-vercel-protection-bypass'] = config.bypassToken;
    }

    if (config.formFactor === 'mobile') {
      return {
        ...baseConfig,
        preset: 'mobile' as const,
        formFactor: 'mobile' as const,
        throttlingMethod: 'simulate' as const,
        throttling: {
          rttMs: 150,
          throughputKbps: 1638.4,
          cpuSlowdownMultiplier: 4,
          requestLatencyMs: 150,
          downloadThroughputKbps: 1638.4,
          uploadThroughputKbps: 750
        },
        screenEmulation: {
          mobile: true,
          width: 375,
          height: 812,
          deviceScaleFactor: 2,
          disabled: false
        },
        extraHeaders: {
          ...baseConfig.extraHeaders,
          'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_7_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.1.2 Mobile/15E148 Safari/604.1'
        }
      };
    } else {
      return {
        ...baseConfig,
        preset: 'desktop' as const,
        formFactor: 'desktop' as const,
        throttling: {
          rttMs: 40,
          throughputKbps: 10240,
          cpuSlowdownMultiplier: 1,
          requestLatencyMs: 0,
          downloadThroughputKbps: 0,
          uploadThroughputKbps: 0
        },
        screenEmulation: {
          mobile: false,
          width: 1350,
          height: 940,
          deviceScaleFactor: 1,
          disabled: false
        },
        extraHeaders: {
          ...baseConfig.extraHeaders,
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
        }
      };
    }
  }

  /**
   * Generate AI insights from audit results
   */
  async generateAIInsights(results: AuditResult[], formFactor: string): Promise<string> {
    if (!this.openai) {
      return 'AI insights not available (no API key provided)';
    }

    const deviceType = formFactor === 'mobile' ? 'mobile devices' : 'desktop';
    const prompt = `
You are a web performance expert. Below is a batch of Lighthouse audit results for multiple URLs on ${deviceType}.

For each URL:
- Briefly summarize the strengths based on scores (not more than 2–3 sentences)
- Mention top 2–3 actionable suggestions from opportunities (not more than 1–2 sentences each)  
- Note any red flags if present (make this short and concise)

At the end, provide:
- A short overall assessment of this batch (short and concise)
- General performance optimization advice applicable to most pages (focus on important aspects and avoid generic advice)
- Clearly state if the pages are performing well or need significant improvements

Audit Data:
${results.map(r => `
URL: ${r.url}
Scores: ${JSON.stringify(r.scores)}
Top Opportunities: ${r.opportunities?.slice(0, 3).map(o => `- ${o.title} (${o.displayValue || 'N/A'})`).join('\n') || 'N/A'}
`).join('\n')}
`;

    try {
      const completion = await this.openai.chat.completions.create({
        model: 'gpt-4',
        messages: [
          { role: 'system', content: 'You are a web performance expert.' },
          { role: 'user', content: prompt }
        ],
        temperature: 0.7
      });

      return completion.choices[0].message.content?.trim() || 'No insights generated';
    } catch (error) {
      console.error('AI insight generation failed:', error);
      return 'Error generating AI insights';
    }
  }

  /**
   * Run audits on multiple URLs with progress tracking
   */
  async auditUrls(
    urls: string[], 
    config: LighthouseConfig,
    reportsDir: string,
    onProgress?: (current: string, completed: number, total: number) => void
  ): Promise<AuditResult[]> {
    // Ensure reports directory exists
    await fs.mkdir(reportsDir, { recursive: true });

    const results: AuditResult[] = [];
    
    for (let i = 0; i < urls.length; i++) {
      const url = urls[i];
      onProgress?.(url, i, urls.length);
      
      const result = await this.auditUrl(
        url, 
        config, 
        reportsDir,
        (message) => console.log(message)
      );
      
      results.push(result);
    }

    // Generate AI insights if API key is available
    if (this.openai) {
      try {
        const insights = await this.generateAIInsights(results, config.formFactor);
        const insightsPath = path.join(reportsDir, `lighthouse-ai-insights-${config.formFactor}-${generateTimestamp()}.txt`);
        await fs.writeFile(insightsPath, insights);
        console.log(`AI insights saved to: ${insightsPath}`);
      } catch (error) {
        console.error('Failed to generate AI insights:', error);
      }
    }

    return results;
  }
}