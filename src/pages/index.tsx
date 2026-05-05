import React, { useState, useCallback } from 'react';
import { Inter } from 'next/font/google';
import Head from 'next/head';
import { useRouter } from 'next/router';
import LighthouseDashboard from '@/components/LighthouseDashboard';
import { ProcessingStatus, AuditResult, LighthouseConfig } from '@/types';

const inter = Inter({ subsets: ['latin'] });

export default function HomePage() {
  const router = useRouter();
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>({ status: 'idle' });
  const [results, setResults] = useState<AuditResult[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);

  const handleLogout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    router.replace('/login');
  }, [router]);

  const handleCancel = useCallback(async () => {
    if (!activeSessionId) return;
    await fetch('/api/audit/cancel', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sessionId: activeSessionId })
    }).catch(() => { /* surfaced via the next poll */ });
  }, [activeSessionId]);

  const handleRunAudit = useCallback(async (urls: string[], config: LighthouseConfig) => {
    try {
      setProcessingStatus({ status: 'processing', progress: 0, totalUrls: urls.length });
      setResults([]);

      const response = await fetch('/api/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ urls, config }),
      });

      if (response.status === 401) {
        router.replace('/login');
        return;
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'Failed to start audit' }));
        throw new Error(errorData.error || 'Failed to start audit');
      }

      const { sessionId } = await response.json();
      setActiveSessionId(sessionId);

      const pollInterval = setInterval(async () => {
        try {
          const statusResponse = await fetch(`/api/audit?sessionId=${sessionId}`);
          if (statusResponse.status === 401) {
            clearInterval(pollInterval);
            router.replace('/login');
            return;
          }
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

            if (status.status === 'completed' || status.status === 'cancelled') {
              setResults(status.results);
              setActiveSessionId(null);
              clearInterval(pollInterval);
            } else if (status.status === 'error') {
              setActiveSessionId(null);
              clearInterval(pollInterval);
            }
          }
        } catch (error) {
          console.error('Status polling error:', error);
          clearInterval(pollInterval);
          setActiveSessionId(null);
          setProcessingStatus({
            status: 'error',
            error: 'Failed to get status updates'
          });
        }
      }, 2000);

      setTimeout(() => clearInterval(pollInterval), 30 * 60 * 1000);

    } catch (error) {
      console.error('Audit error:', error);
      setActiveSessionId(null);
      setProcessingStatus({
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  }, [router]);

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
          onCancel={handleCancel}
          onLogout={handleLogout}
          processingStatus={processingStatus}
          results={results}
          canCancel={!!activeSessionId}
        />
      </div>
    </>
  );
}
