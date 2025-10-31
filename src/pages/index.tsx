import React, { useState, useCallback } from 'react';
import { Inter } from 'next/font/google';
import Head from 'next/head';
import LighthouseDashboard from '@/components/LighthouseDashboard';
import { ProcessingStatus, AuditResult, LighthouseConfig } from '@/types';

const inter = Inter({ subsets: ['latin'] });

export default function HomePage() {
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>({ status: 'idle' });
  const [results, setResults] = useState<AuditResult[]>([]);

  /**
   * Handle running lighthouse audit
   */
  const handleRunAudit = useCallback(async (urls: string[], config: LighthouseConfig) => {
    try {
      setProcessingStatus({ 
        status: 'processing', 
        progress: 0, 
        totalUrls: urls.length 
      });
      setResults([]);

      // Start audit
      const response = await fetch('/api/audit', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ urls, config }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to start audit' }));
        throw new Error(errorData.error || 'Failed to start audit');
      }

      const { sessionId } = await response.json();

      // Poll for status updates
      const pollInterval = setInterval(async () => {
        try {
          const statusResponse = await fetch(`/api/audit?sessionId=${sessionId}`);
          if (statusResponse.ok) {
            const status = await statusResponse.json();
            
            setProcessingStatus({
              status: status.status,
              currentUrl: status.currentUrl,
              progress: status.progress,
              totalUrls: status.total,
              error: status.error,
              insightsFile: status.insightsFile
            });

            if (status.status === 'completed') {
              setResults(status.results);
              clearInterval(pollInterval);
            } else if (status.status === 'error') {
              clearInterval(pollInterval);
            }
          }
        } catch (error) {
          console.error('Status polling error:', error);
          clearInterval(pollInterval);
          setProcessingStatus({
            status: 'error',
            error: 'Failed to get status updates'
          });
        }
      }, 2000); // Poll every 2 seconds

      // Cleanup timeout after 30 minutes
      setTimeout(() => {
        clearInterval(pollInterval);
      }, 30 * 60 * 1000);

    } catch (error) {
      console.error('Audit error:', error);
      setProcessingStatus({
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  }, []);

  return (
    <>
      <Head>
        <title>Lighthouse AI Audit Dashboard</title>
        <meta name="description" content="Run Lighthouse performance audits with AI-powered insights" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>
      
      <div className={inter.className}>
        <LighthouseDashboard
          onRunAudit={handleRunAudit}
          processingStatus={processingStatus}
          results={results}
        />
      </div>
    </>
  );
}