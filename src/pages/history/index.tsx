import React, { useEffect, useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { ArrowLeft, BarChart3 } from 'lucide-react';
import Sparkline from '@/components/Sparkline';

interface HistoryEntry {
  url: string;
  formFactor: string;
  runCount: number;
  lastRunAt: number;
  latestScores: {
    performance: number;
    accessibility: number;
    'best-practices': number;
    seo: number;
  };
  perfTrend: number[];
}

type FormFactor = 'desktop' | 'mobile';

function scoreColor(score: number): string {
  if (score >= 90) return 'text-green-400';
  if (score >= 50) return 'text-accent-400';
  return 'text-red-400';
}

function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} hr ago`;
  const day = Math.floor(hr / 24);
  if (day < 30) return `${day} day${day === 1 ? '' : 's'} ago`;
  return new Date(ts).toLocaleDateString();
}

export default function HistoryPage() {
  const router = useRouter();
  const [formFactor, setFormFactor] = useState<FormFactor>('desktop');
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetch(`/api/history?formFactor=${formFactor}`)
      .then(r => {
        if (r.status === 401) {
          router.replace('/login');
          return Promise.reject(new Error('Session expired'));
        }
        return r.ok ? r.json() : Promise.reject(new Error('Failed to load history'));
      })
      .then(data => {
        if (!cancelled) setEntries(data.entries);
      })
      .catch(e => {
        if (!cancelled) setError(e.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => { cancelled = true; };
  }, [formFactor, router]);

  return (
    <>
      <Head>
        <title>Audit History · Lighthouse Checker</title>
      </Head>

      <div className="min-h-screen bg-navy-950 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between mb-8">
            <div>
              <Link href="/" className="link-primary inline-flex items-center text-sm mb-2">
                <ArrowLeft className="w-4 h-4 mr-1" /> Dashboard
              </Link>
              <h1 className="text-3xl font-bold text-gray-100 flex items-center">
                <BarChart3 className="w-7 h-7 mr-3 text-accent-400" />
                Audit History
              </h1>
              <p className="text-sm text-gray-400 mt-1">
                Past Lighthouse runs grouped by URL. Click a row to see full history.
              </p>
            </div>

            <div>
              <label className="text-xs text-gray-400 block mb-1">Form factor</label>
              <select
                value={formFactor}
                onChange={(e) => setFormFactor(e.target.value as FormFactor)}
                className="input w-32"
              >
                <option value="desktop">Desktop</option>
                <option value="mobile">Mobile</option>
              </select>
            </div>
          </div>

          <div className="card overflow-hidden">
            {loading && (
              <div className="p-8 text-center text-gray-400">Loading history…</div>
            )}

            {!loading && error && (
              <div className="p-8 text-center text-red-400">{error}</div>
            )}

            {!loading && !error && entries.length === 0 && (
              <div className="p-12 text-center">
                <p className="text-gray-300 mb-4">
                  No {formFactor} audits yet.
                </p>
                <Link href="/" className="btn-primary">
                  Run your first audit
                </Link>
              </div>
            )}

            {!loading && !error && entries.length > 0 && (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-navy-700">
                  <thead className="table-header">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">URL</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Trend</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Perf</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">A11y</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Best Pr.</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">SEO</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Runs</th>
                      <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider">Last run</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-navy-700">
                    {entries.map((e) => {
                      const href = `/history/${encodeURIComponent(e.url)}?formFactor=${e.formFactor}`;
                      return (
                        <tr key={`${e.url}::${e.formFactor}`} className="table-row">
                          <td className="px-4 py-3 max-w-xs">
                            <Link href={href} className="link-primary text-sm font-mono truncate block">
                              {e.url}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-accent-400">
                            <Sparkline values={e.perfTrend} />
                          </td>
                          <td className={`px-4 py-3 text-sm font-bold ${scoreColor(e.latestScores.performance)}`}>
                            {e.latestScores.performance}
                          </td>
                          <td className={`px-4 py-3 text-sm font-bold ${scoreColor(e.latestScores.accessibility)}`}>
                            {e.latestScores.accessibility}
                          </td>
                          <td className={`px-4 py-3 text-sm font-bold ${scoreColor(e.latestScores['best-practices'])}`}>
                            {e.latestScores['best-practices']}
                          </td>
                          <td className={`px-4 py-3 text-sm font-bold ${scoreColor(e.latestScores.seo)}`}>
                            {e.latestScores.seo}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-300">{e.runCount}</td>
                          <td className="px-4 py-3 text-sm text-gray-400">{relativeTime(e.lastRunAt)}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
