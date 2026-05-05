import '@/styles/globals.css';
import type { AppProps } from 'next/app';
import { useRouter } from 'next/router';
import { useEffect, useState } from 'react';

const PUBLIC_PATHS = new Set(['/login']);

export default function App({ Component, pageProps }: AppProps) {
  const router = useRouter();
  const [authChecked, setAuthChecked] = useState(false);

  useEffect(() => {
    if (PUBLIC_PATHS.has(router.pathname)) {
      setAuthChecked(true);
      return;
    }

    let cancelled = false;
    fetch('/api/auth/me')
      .then(r => r.json())
      .then(data => {
        if (cancelled) return;
        if (!data.authenticated) {
          const next = encodeURIComponent(router.asPath);
          router.replace(`/login?next=${next}`);
        } else {
          setAuthChecked(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          router.replace('/login');
        }
      });

    return () => { cancelled = true; };
  }, [router.pathname, router.asPath, router]);

  if (!authChecked) {
    return (
      <div className="min-h-screen bg-navy-950 flex items-center justify-center">
        <div className="text-gray-400 text-sm">Loading…</div>
      </div>
    );
  }

  return <Component {...pageProps} />;
}
