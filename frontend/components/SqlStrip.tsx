'use client';
import { useState, useEffect } from 'react';
import clsx from 'clsx';
import styles from './SqlStrip.module.css';
import type { QueryType } from '@sql-assistant/shared';
import { useLang } from '../lib/language-context';
import type { Lang } from '../lib/language-context';

const T = {
  es: { dmv: 'Consulta DMV', business: 'SQL generado', copy: 'Copiar para SSMS', copied: '✓ Copiado' },
  en: { dmv: 'DMV Query',    business: 'Generated SQL', copy: 'Copy for SSMS',   copied: '✓ Copied'  },
} as const;

interface Props {
  sql:       string;
  queryType: QueryType;
}

export default function SqlStrip({ sql, queryType }: Props) {
  // DMV collapsed by default, business expanded — per SRS SQL-13
  const [open, setOpen] = useState(queryType === 'business');
  const [copied, setCopied] = useState(false);
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const { lang } = useLang();
  const t = T[lang as Lang];

  useEffect(() => {
    if (!sql) return;
    import('shiki').then(({ codeToHtml }) =>
      codeToHtml(sql, { lang: 'tsql', theme: 'github-dark' })
    ).then(setHighlighted).catch(() => {});
  }, [sql]);

  const copy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    await navigator.clipboard.writeText(sql);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  const label = queryType === 'dmv' ? t.dmv : t.business;

  return (
    <div className={styles.container}>
      <div className={styles.header} onClick={() => setOpen(o => !o)}>
        <span className={clsx(styles.label, queryType === 'dmv' && styles.labelPerformance)}>
          {label}
        </span>
        <div className={styles.actions}>
          {sql && (
            <button className={styles.copyBtn} onClick={copy}>
              {copied ? t.copied : t.copy}
            </button>
          )}
          <span className={clsx(styles.chevron, open && styles.chevronOpen)}>▾</span>
        </div>
      </div>
      <div className={clsx(styles.body, open && styles.bodyOpen)}>
        {highlighted ? (
          <div
            className={styles.highlighted}
            dangerouslySetInnerHTML={{ __html: highlighted }}
          />
        ) : (
          <pre className={styles.code}>{sql}</pre>
        )}
      </div>
    </div>
  );
}