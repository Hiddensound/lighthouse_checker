import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Inter } from 'next/font/google';
import Head from 'next/head';
import { useRouter } from 'next/router';
import LighthouseDashboard from '@/components/LighthouseDashboard';
import { ProcessingStatus, AuditResult, LighthouseConfig } from '@/types';

const inter = Inter({ subsets: ['latin'] });

const SESSION_STORAGE_KEY = 'lighthouse:lastSessionId';

function applyStatusToState(
  status: any,
  setProcessingStatus: (s: ProcessingStatus) => void,
  setResults: (r: AuditResult[]) => void
) {
  setProcessingStatus({
    status: status.status,
    currentUrl: status.currentUrl,
    progress: status.progress,
    totalUrls: status.total,
    error: status.error,
    insightsFile: status.insightsFile
  });
  setResults(status.results || []);
}

export default function HomePage() {
  const router = useRouter();
  const [processingStatus, setProcessingStatus] = useState<ProcessingStatus>({ status: 'idle' });
  const [results, setResults] = useState<AuditResult[]>([]);
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null);
  const pollIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const stopPolling = useCallback(() => {
    if (pollIntervalRef.current) {
      clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
  }, []);

  const startPolling = useCallback((sessionId: string) => {
    stopPolling();
    pollIntervalRef.current = setInterval(async () => {
      try {
        const r = await fetch(`/api/audit?sessionId=${sessionId}`);
        if (r.status === 401) {
          stopPolling();
          router.replace('/login');
          return;
        }
        if (!r.ok) return;
        const status = await r.json();
        applyStatusToState(status, setProcessingStatus, setResults);

        if (status.status === 'completed' || status.status === 'cancelled' || status.status === 'error') {
          setActiveSessionId(null);
          stopPolling();
        }
      } catch (error) {
        console.error('Status polling error:', error);
        stopPolling();
        setActiveSessionId(null);
        setProcessingStatus({ status: 'error', error: 'Failed to get status updates' });
      }
    }, 2000);
  }, [router, stopPolling]);

  // Restore the last session on mount so navigating to /history and back
  // doesn't make the results vanish. If the session is still processing,
  // resume polling; otherwise just show the snapshot.
  useEffect(() => {
    const last = typeof window !== 'undefined'
      ? localStorage.getItem(SESSION_STORAGE_KEY)
      : null;
    if (!last) return;

    fetch(`/api/audit?sessionId=${last}`)
      .then(r => {
        if (r.status === 401) {
          router.replace('/login');
          return null;
        }
        return r.ok ? r.json() : null;
      })
      .then(status => {
        if (!status) return;
        applyStatusToState(status, setProcessingStatus, setResults);
        if (status.status === 'processing') {
          setActiveSessionId(last);
          startPolling(last);
        }
      })
      .catch(() => { /* stale id is fine — leave the dashboard idle */ });

    return () => stopPolling();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleLogout = useCallback(async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    localStorage.removeItem(SESSION_STORAGE_KEY);
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
      localStorage.setItem(SESSION_STORAGE_KEY, sessionId);
      setActiveSessionId(sessionId);
      startPolling(sessionId);

    } catch (error) {
      console.error('Audit error:', error);
      setActiveSessionId(null);
      setProcessingStatus({
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      });
    }
  }, [router, startPolling]);

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
