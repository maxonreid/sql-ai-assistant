'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { apiUrl } from '../lib/api';

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    const authed = sessionStorage.getItem('sql-assistant:authed') === '1';
    if (authed) { router.replace('/chat'); return; }

    fetch(apiUrl('/api/auth/status'))
      .then(r => r.json() as Promise<{ setupRequired: boolean }>)
      .then(({ setupRequired }) => router.replace(setupRequired ? '/setup' : '/login'))
      .catch(() => router.replace('/login'));
  }, [router]);

  return null;
}
