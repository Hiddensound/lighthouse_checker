import React, { useState } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import { Lock } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password })
      });

      if (res.ok) {
        const next = typeof router.query.next === 'string' ? router.query.next : '/';
        router.replace(next.startsWith('/') ? next : '/');
        return;
      }

      const data = await res.json().catch(() => ({}));
      setError(data.error || 'Login failed');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Login failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <Head>
        <title>Sign in · Lighthouse Checker</title>
      </Head>

      <div className="min-h-screen bg-navy-950 flex items-center justify-center px-4">
        <div className="card w-full max-w-md p-8">
          <div className="flex flex-col items-center mb-6">
            <div className="bg-accent-500/20 rounded-full p-3 mb-3">
              <Lock className="w-6 h-6 text-accent-400" />
            </div>
            <h1 className="text-xl font-bold text-gray-100">Operator sign-in</h1>
            <p className="text-sm text-gray-400 mt-1 text-center">
              Enter the operator password to access the dashboard.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-200 mb-2">
                Password
              </label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="input"
                autoFocus
                required
              />
            </div>

            {error && (
              <div className="text-sm text-red-400 bg-red-900/30 border border-red-800 rounded-md p-3">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={submitting || password.length === 0}
              className="btn-primary w-full disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
