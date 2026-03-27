'use client';
import { useState, useEffect } from 'react';
import clsx from 'clsx';
import styles from './AIProviderSettings.module.css';
import type { AIProviderConfig } from '@sql-assistant/shared';
import { apiUrl } from '../lib/api';

export default function AIProviderSettings() {
  const [config, setConfig] = useState<AIProviderConfig>({
    ai_provider:     'external',
    local_model:     'deepseek-coder',
    ollama_url:      'http://localhost:11434',
    anthropic_model: 'claude-sonnet-4-5',
  });
  const [models,  setModels]  = useState<string[]>([]);
  const [status,  setStatus]  = useState<'idle' | 'ok' | 'error'>('idle');
  const [errMsg,  setErrMsg]  = useState('');
  const [saving,  setSaving]  = useState(false);

  useEffect(() => {
    fetch(apiUrl('/api/settings/ai-provider'))
      .then(r => r.json() as Promise<AIProviderConfig>)
      .then(setConfig);
  }, []);

  const testOllama = async () => {
    setStatus('idle'); setErrMsg('');
    const res  = await fetch(apiUrl('/api/settings/test-ollama'), {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify({ ollama_url: config.ollama_url }),
    });
    const data = await res.json() as { ok: boolean; models?: string[]; error?: string };
    if (data.ok) { setModels(data.models ?? []); setStatus('ok'); }
    else         { setStatus('error'); setErrMsg(data.error ?? 'Unknown error'); }
  };

  const save = async () => {
    setSaving(true);
    await fetch(apiUrl('/api/settings/ai-provider'), {
      method:  'PUT',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(config),
    });
    setSaving(false);
  };

  return (
    <div className={styles.panel}>
      <h2 className={styles.title}>AI Provider</h2>

      {/* Provider toggle */}
      <div className={styles.toggle}>
        <button
          className={clsx(styles.toggleBtn, config.ai_provider === 'external' && styles.toggleBtnActive)}
          onClick={() => setConfig(c => ({ ...c, ai_provider: 'external' }))}
        >
          ☁ External — Anthropic Claude
        </button>
        <button
          className={clsx(styles.toggleBtn, config.ai_provider === 'local' && styles.toggleBtnActive)}
          onClick={() => setConfig(c => ({ ...c, ai_provider: 'local' }))}
        >
          ⚙ Local — Ollama
        </button>
      </div>

      {/* Local AI options */}
      {config.ai_provider === 'local' && (
        <div className={styles.fieldGroup}>
          <p className={styles.hint}>
            Local AI runs entirely on this machine. No data is sent externally.
            Response times depend on your hardware — a GPU significantly improves speed.
          </p>
          <label className={styles.label}>
            Ollama URL
            <input
              className={styles.input}
              value={config.ollama_url}
              onChange={e => setConfig(c => ({ ...c, ollama_url: e.target.value }))}
              placeholder="http://localhost:11434"
            />
          </label>
          <label className={styles.label}>
            Model
            {models.length > 0
              ? (
                <select
                  className={styles.select}
                  value={config.local_model}
                  onChange={e => setConfig(c => ({ ...c, local_model: e.target.value }))}
                >
                  {models.map(m => <option key={m} value={m}>{m}</option>)}
                </select>
              )
              : (
                <input
                  className={styles.input}
                  value={config.local_model}
                  onChange={e => setConfig(c => ({ ...c, local_model: e.target.value }))}
                  placeholder="deepseek-coder"
                />
              )
            }
          </label>
          <div className={styles.testRow}>
            <button className={styles.testBtn} onClick={testOllama}>
              Test connection
            </button>
            {status === 'ok'    && <span className={styles.statusOk}>✓ Connected · {models.length} model(s) found</span>}
            {status === 'error' && <span className={styles.statusError}>✗ {errMsg}</span>}
          </div>
        </div>
      )}

      {/* External AI options */}
      {config.ai_provider === 'external' && (
        <div className={styles.fieldGroup}>
          <label className={styles.label}>
            Model
            <select
              className={styles.select}
              value={config.anthropic_model}
              onChange={e => setConfig(c => ({ ...c, anthropic_model: e.target.value }))}
            >
              <option value="claude-sonnet-4-5">claude-sonnet-4-5 (recommended)</option>
              <option value="claude-opus-4-5">claude-opus-4-5</option>
            </select>
          </label>
        </div>
      )}

      <button className={styles.saveBtn} onClick={save} disabled={saving}>
        {saving ? 'Saving…' : 'Save'}
      </button>
    </div>
  );
}