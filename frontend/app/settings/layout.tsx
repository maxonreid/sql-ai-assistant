'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import clsx from 'clsx';
import styles from './layout.module.css';

const NAV = [
  { href: '/settings/connections', label: 'Connections' },
  { href: '/settings/ai-provider', label: 'AI Provider' },
  { href: '/settings/preferences', label: 'Preferences' },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname();

  return (
    <div className={styles.shell}>
      <header className={styles.topbar}>
        <Link href="/chat" className={styles.back}>← Chat</Link>
        <span className={styles.heading}>Settings</span>
      </header>

      <div className={styles.body}>
        <nav className={styles.sidebar}>
          {NAV.map(({ href, label }) => (
            <Link
              key={href}
              href={href}
              className={clsx(styles.navLink, path.startsWith(href) && styles.navLinkActive)}
            >
              {label}
            </Link>
          ))}
        </nav>

        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}
