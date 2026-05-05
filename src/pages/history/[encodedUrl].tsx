import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { ArrowLeft, Download } from 'lucide-react';
import Sparkline from '@/components/Sparkline';
import ScoreDelta from '@/components/ScoreDelta';

interface Run {
  id: number;
  url: string;
  formFactor: string;
  createdAt: number;
  scores?: {
    performance: number;
    accessibility: number;
    'best-practices': number;
    seo: number;
  };
  reportPaths?: { html: string; json: string };
  error?: string;
}

type FormFactor = 'desktop' | 'mobile';

function scoreColor(score: number): string {
  if (score >= 90) return 'text-green-400';
  if (score >= 50) return 'text-accent-400';
  return 'text-red-400';
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleString();
}

export default function HistoryDetailPage() {
  const router = useRouter();
  const { encodedUrl, formFactor: queryFf } = router.query;
  const formFactor: FormFactor = queryFf === 'mobile' ? 'mobile' : 'desktop';

  const [url, setUrl] = useState<string>('');
  const [runs, setRuns] = useState<Run[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (typeof encodedUrl !== 'string') return;

    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/history/${encodedUrl}?formFactor=${formFactor}`)
      .then(r => r.ok ? r.json() : Promise.reject(new Error('Failed to load history')))
      .then(data => {
        if (cancelled) return;
        setUrl(data.url);
        setRuns(data.runs);
      })
      .catch(e => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [encodedUrl, formFactor]);

  // Runs come back newest-first; sparkline wants oldest-first.
  const successfulRuns = runs.filter(r => r.scores);
  const trendValues = successfulRuns
    .map(r => r.scores!.performance)
    .reverse();

  return (
    <>
      <Head>
        <title>{url ? `${url} · History` : 'Audit History'}</title>
      </Head>

      <div className="min-h-screen bg-navy-950 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link href="/history" className="link-primary inline-flex items-center text-sm mb-2">
            <ArrowLeft className="w-4 h-4 mr-1" /> History
          </Link>

          <h1 className="text-2xl font-bold text-gray-100 mb-1 break-all">
            {url || 'Loading…'}
          </h1>
          <p className="text-sm text-gray-400 mb-6">
            {formFactor.charAt(0).toUpperCase() + formFactor.slice(1)} runs
          </p>

          {loading && (
            <div className="card p-8 text-center text-gray-400">Loading…</div>
          )}

          {!loading && error && (
            <div className="card p-8 text-center text-red-400">{error}</div>
          )}

          {!loading && !error && runs.length === 0 && (
            <div className="card p-8 text-center text-gray-400">
              No runs found for this URL on {formFactor}.
            </div>
          )}

          {!loading && !error && runs.length > 0 && (
            <>
              {trendValues.length >= 2 && (
                <div className="card p-6 mb-6">
                  <h2 className="text-sm font-semibold text-gray-300 mb-3">
                    Performance trend ({trendValues.length} runs)
                  </h2>
                  <div className="text-accent-400">
                    <Sparkline values={trendValues} width={600} height={80} />
                  </div>
                </div>
              )}

              <div className="card overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-navy-700">
                    <thead className="table-header">
                      <tr>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">When</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Performance</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Accessibility</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Best Practices</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">SEO</th>
                        <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Report</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-navy-700">
                      {runs.map((run, idx) => {
                        // "Previous" is the next entry (older) in the desc-sorted list.
                        const previous = runs[idx + 1];
                        return (
                          <tr key={run.id} className="table-row">
                            <td className="px-4 py-3 text-sm text-gray-300 whitespace-nowrap">
                              {formatTime(run.createdAt)}
                            </td>
                            {run.scores ? (
                              <>
                                <td className="px-4 py-3">
                                  <div className={`text-sm font-bold ${scoreColor(run.scores.performance)}`}>
                                    {run.scores.performance}
                                  </div>
                                  <ScoreDelta
                                    current={run.scores.performance}
                                    previous={previous?.scores?.performance}
                                  />
                                </td>
                                <td className="px-4 py-3">
                                  <div className={`text-sm font-bold ${scoreColor(run.scores.accessibility)}`}>
                                    {run.scores.accessibility}
                                  </div>
                                  <ScoreDelta
                                    current={run.scores.accessibility}
                                    previous={previous?.scores?.accessibility}
                                  />
                                </td>
                                <td className="px-4 py-3">
                                  <div className={`text-sm font-bold ${scoreColor(run.scores['best-practices'])}`}>
                                    {run.scores['best-practices']}
                                  </div>
                                  <ScoreDelta
                                    current={run.scores['best-practices']}
                                    previous={previous?.scores?.['best-practices']}
                                  />
                                </td>
                                <td className="px-4 py-3">
                                  <div className={`text-sm font-bold ${scoreColor(run.scores.seo)}`}>
                                    {run.scores.seo}
                                  </div>
                                  <ScoreDelta
                                    current={run.scores.seo}
                                    previous={previous?.scores?.seo}
                                  />
                                </td>
                                <td className="px-4 py-3">
                                  {run.reportPaths?.html && (
                                    <a
                                      href={run.reportPaths.html}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="badge-download"
                                    >
                                      <Download className="w-3.5 h-3.5 mr-1.5" />
                                      HTML
                                    </a>
                                  )}
                                </td>
                              </>
                            ) : (
                              <td colSpan={5} className="px-4 py-3 text-sm text-red-400">
                                Error: {run.error}
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </>
  );
}
