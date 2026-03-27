'use client';
import { useState, useRef, useEffect } from 'react';
import type { Connection, QueryResult } from '@sql-assistant/shared';
import AIProviderBadge from '../../components/AIProviderBadge';
import ConnPanel from '../../components/ConnPanel';
import ResultPanel from '../../components/ResultPanel';
import SqlStrip from '../../components/SqlStrip';
import styles from './page.module.css';
import { apiUrl } from '../../lib/api';

interface Turn {
  question: string;
  result: QueryResult;
}

const T = {
  es: {
    placeholder: 'Escribe tu pregunta sobre la base de datos… (Ctrl+Enter para enviar)',
    send: 'Enviar',
    loading: 'Consultando…',
    empty: 'Haz una pregunta sobre tu base de datos.',
    noConn: 'Sin conexiones',
  },
  en: {
    placeholder: 'Ask a question about your database… (Ctrl+Enter to send)',
    send: 'Send',
    loading: 'Running query…',
    empty: 'Ask a question about your database.',
    noConn: 'No connections',
  },
} as const;

type Lang = keyof typeof T;

export default function ChatPage() {
  const [lang, setLang] = useState<Lang>('es');
  const t = T[lang];

  const [connections, setConnections] = useState<Connection[]>([]);
  const [connectionId, setConnectionId] = useState<number | null>(null);
  const [turns, setTurns] = useState<Turn[]>([]);
  const [question, setQuestion] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    fetch(apiUrl('/api/connections'))
      .then(r => r.json() as Promise<Connection[]>)
      .then(list => {
        setConnections(list);
        const active = list.find(c => c.is_active) ?? list[0];
        if (active) setConnectionId(active.id);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [turns, loading]);

  const submit = async () => {
    const q = question.trim();
    if (!q || connectionId === null || loading) return;

    setLoading(true);
    setError(null);
    setQuestion('');

    try {
      const res = await fetch(apiUrl('/api/query'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: q, connectionId, language: lang }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({})) as { error?: string };
        throw new Error(body.error ?? res.statusText);
      }

      const result = await res.json() as QueryResult;
      setTurns(prev => [...prev, { question: q, result }]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoading(false);
      textareaRef.current?.focus();
    }
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      submit();
    }
  };

  const canSubmit = question.trim().length > 0 && connectionId !== null && !loading;

  return (
    <div className={styles.shell}>
      {/* ── Top bar ── */}
      <header className={styles.topbar}>
        <span className={styles.appName}>SQL Assistant</span>

        <div className={styles.controls}>
          <ConnPanel
            connections={connections}
            value={connectionId}
            onChange={setConnectionId}
            noConnLabel={t.noConn}
          />

          <select
            className={styles.select}
            value={lang}
            onChange={e => setLang(e.target.value as Lang)}
          >
            <option value="es">ES</option>
            <option value="en">EN</option>
          </select>

          <AIProviderBadge />
        </div>
      </header>

      {/* ── Chat feed ── */}
      <main className={styles.feed}>
        {turns.length === 0 && !loading && !error && (
          <p className={styles.empty}>{t.empty}</p>
        )}

        {turns.map((turn, i) => (
          <div key={i} className={styles.turn}>
            <div className={styles.question}>{turn.question}</div>
            <SqlStrip sql={turn.result.sql} queryType={turn.result.queryType} />
            <ResultPanel result={turn.result} />
          </div>
        ))}

        {loading && (
          <div className={styles.loadingRow}>
            <span className={styles.spinner} />
            <span className={styles.loadingLabel}>{t.loading}</span>
          </div>
        )}

        {error && (
          <div className={styles.errorBox}>{error}</div>
        )}

        <div ref={bottomRef} />
      </main>

      {/* ── Input bar ── */}
      <footer className={styles.inputBar}>
        <textarea
          ref={textareaRef}
          className={styles.textarea}
          value={question}
          onChange={e => setQuestion(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={t.placeholder}
          rows={2}
          disabled={loading || connectionId === null}
        />
        <button
          className={styles.sendBtn}
          onClick={submit}
          disabled={!canSubmit}
        >
          {t.send}
        </button>
      </footer>
    </div>
  );
}
