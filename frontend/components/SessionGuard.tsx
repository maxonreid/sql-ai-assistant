'use client';
import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { clearSession } from '../lib/api';

const IDLE_MS  = 30 * 60 * 1000; // 30 minutes
const PROTECTED = ['/chat', '/settings'];

export default function SessionGuard({ children }: { children: React.ReactNode }) {
  const router   = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!PROTECTED.some(p => pathname.startsWith(p))) return;

    let timer: ReturnType<typeof setTimeout>;

    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(() => {
        clearSession();
        router.replace('/login');
      }, IDLE_MS);
    };

    const events = ['mousemove', 'keydown', 'mousedown', 'touchstart'] as const;
    events.forEach(e => window.addEventListener(e, reset, { passive: true }));
    reset(); // arm immediately

    return () => {
      clearTimeout(timer);
      events.forEach(e => window.removeEventListener(e, reset));
    };
  }, [pathname, router]);

  return <>{children}</>;
}
