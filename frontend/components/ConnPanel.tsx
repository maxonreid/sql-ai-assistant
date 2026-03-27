'use client';
import type { Connection } from '@sql-assistant/shared';
import styles from './ConnPanel.module.css';

interface ConnPanelProps {
  connections: Connection[];
  value: number | null;
  onChange: (id: number) => void;
  noConnLabel: string;
}

export default function ConnPanel({ connections, value, onChange, noConnLabel }: ConnPanelProps) {
  const selected = connections.find(c => c.id === value);

  if (connections.length === 0) {
    return (
      <a href="/settings/connections" className={styles.empty}>
        {noConnLabel}
      </a>
    );
  }

  return (
    <div className={styles.wrapper}>
      <span
        className={selected?.is_active === 1 ? styles.dotActive : styles.dotInactive}
        aria-hidden="true"
      />
      <select
        className={styles.select}
        value={value ?? ''}
        onChange={e => onChange(Number(e.target.value))}
      >
        {connections.map(c => (
          <option key={c.id} value={c.id}>{c.name}</option>
        ))}
      </select>
    </div>
  );
}
