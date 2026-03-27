'use client';
import { useState } from 'react';
import clsx from 'clsx';
import styles from './SqlStrip.module.css';
import type { QueryType } from '@sql-assistant/shared';

interface Props {
  sql:       string;
  queryType: QueryType;
}

export default function SqlStrip({ sql, queryType }: Props) {
  // DMV collapsed by default, business expanded — per SRS SQL-13
  const [open, setOpen] = useState(queryType === 'business');
  const [copied, setCopied] = useState(false);

  const copy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const label = queryType === 'dmv' ? 'Consulta DMV' : 'SQL generado';

  return (
    <div className={styles.container}>
      <div className={styles.header} onClick={() => setOpen(o => !o)}>
        <span className={clsx(styles.label, queryType === 'dmv' && styles.labelPerformance)}>
          {label}
        </span>
        <div className={styles.actions}>
          {sql && (
            <button className={styles.copyBtn} onClick={copy}>
              {copied ? '✓ Copied' : 'Copy for SSMS'}
            </button>
          )}
          <span className={clsx(styles.chevron, open && styles.chevronOpen)}>▾</span>
        </div>
      </div>
      <div className={clsx(styles.body, open && styles.bodyOpen)}>
        <pre className={styles.code}>{sql}</pre>
      </div>
    </div>
  );
}