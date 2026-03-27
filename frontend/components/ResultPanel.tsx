'use client';
import { useState } from 'react';
import clsx from 'clsx';
import styles from './ResultPanel.module.css';
import type { QueryResult } from '@sql-assistant/shared';

interface Props {
  result: QueryResult;
}

type SortDir = 'asc' | 'desc';

export default function ResultPanel({ result }: Props) {
  const { responseType, rows, columns, textSummary, dmvSources } = result;
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<SortDir>('asc');

  const handleSort = (col: string) => {
    if (sortCol === col) setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    else { setSortCol(col); setSortDir('asc'); }
  };

  const sortedRows = sortCol
    ? [...rows].sort((a, b) => {
        const av = String(a[sortCol] ?? '');
        const bv = String(b[sortCol] ?? '');
        return sortDir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
      })
    : rows;

  const exportCSV = () => {
    const header = columns.join(',');
    const body   = rows.map(r => columns.map(c => `"${r[c] ?? ''}"`).join(',')).join('\n');
    const blob   = new Blob([header + '\n' + body], { type: 'text/csv' });
    const url    = URL.createObjectURL(blob);
    const a      = document.createElement('a');
    a.href = url; a.download = 'result.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const badgeClass = {
    table:       styles.badgeTable,
    text:        styles.badgeText,
    mixed:       styles.badgeMixed,
    performance: styles.badgePerformance,
  }[responseType];

  const progressColor = (value: number) =>
    value >= 90 ? styles.progressGreen :
    value >= 70 ? styles.progressAmber : styles.progressRed;

  return (
    <div className={styles.panel}>
      {/* Header */}
      <div className={styles.header}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
          <span className={clsx(styles.badge, badgeClass)}>
            {responseType}
          </span>
          {dmvSources?.length > 0 && (
            <div className={styles.dmvSources}>
              {dmvSources.map(s => (
                <span key={s} className={styles.dmvTag}>{s}</span>
              ))}
            </div>
          )}
        </div>
        {rows.length > 0 && (
          <button className={styles.exportBtn} onClick={exportCSV}>
            Export CSV
          </button>
        )}
      </div>

      {/* KPI cards — performance only */}
      {responseType === 'performance' && rows.length > 0 && columns.length <= 4 && (
        <div className={styles.kpiGrid}>
          {columns.map(col => (
            <div key={col} className={styles.kpiCard}>
              <div className={styles.kpiLabel}>{col}</div>
              <div className={styles.kpiValue}>{String(rows[0][col] ?? '—')}</div>
            </div>
          ))}
        </div>
      )}

      {/* Warning box — mixed type */}
      {responseType === 'mixed' && textSummary && (
        <div className={styles.warningBox}>{textSummary}</div>
      )}

      {/* Narrative — text type */}
      {responseType === 'text' && textSummary && (
        <div className={styles.narrative}>{textSummary}</div>
      )}

      {/* Data table */}
      {rows.length > 0 && responseType !== 'text' && (
        <div className={styles.tableWrapper}>
          <table>
            <thead>
              <tr>
                {columns.map(col => (
                  <th key={col} onClick={() => handleSort(col)}>
                    {col} {sortCol === col ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sortedRows.map((row, i) => (
                <tr key={i}>
                  {columns.map(col => {
                    const val    = row[col];
                    const numVal = typeof val === 'number' ? val : null;
                    return (
                      <td key={col}>
                        {responseType === 'performance' && numVal !== null && numVal <= 100
                          ? (
                            <div className={styles.progressCell}>
                              <span>{numVal}%</span>
                              <div className={styles.progressBar}>
                                <div
                                  className={clsx(styles.progressFill, progressColor(numVal))}
                                  style={{ width: `${numVal}%` }}
                                />
                              </div>
                            </div>
                          )
                          : String(val ?? '')
                        }
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}