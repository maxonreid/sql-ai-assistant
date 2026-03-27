'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function RootPage() {
  const router = useRouter();

  useEffect(() => {
    const authed = sessionStorage.getItem('sql-assistant:authed') === '1';
    router.replace(authed ? '/chat' : '/login');
  }, [router]);

  return null;
}
