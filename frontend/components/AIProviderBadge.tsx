'use client';
import { useEffect, useState } from 'react';
import clsx from 'clsx';
import styles from './AIProviderBadge.module.css';
import type { AIProviderConfig } from '@sql-assistant/shared';
import { apiFetch } from '../lib/api';

export default function AIProviderBadge() {
  const [provider, setProvider] = useState<'external' | 'local'>('external');

  useEffect(() => {
    apiFetch('/api/settings/ai-provider')
      .then(r => r.json() as Promise<AIProviderConfig>)
      .then(c => setProvider(c.ai_provider));
  }, []);

  return (
    <a
      href="/settings/ai-provider"
      className={clsx(styles.badge, provider === 'local' ? styles.local : styles.external)}
      title="Change AI Provider"
    >
      {provider === 'local' ? '⚙ Local' : '☁ Claude'}
    </a>
  );
}