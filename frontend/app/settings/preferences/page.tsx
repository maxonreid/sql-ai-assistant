'use client';
import { useState, useEffect } from 'react';
import clsx from 'clsx';
import styles from './page.module.css';

const LANG_KEY = 'sql-assistant:lang';

export default function PreferencesPage() {
  const [lang, setLang] = useState<'es' | 'en'>('es');
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(LANG_KEY);
    if (stored === 'en' || stored === 'es') setLang(stored);
  }, []);

  const select = (l: 'es' | 'en') => {
    setLang(l);
    localStorage.setItem(LANG_KEY, l);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className={styles.page}>
      <h1 className={styles.heading}>Preferences</h1>

      <section className={styles.section}>
        <h2 className={styles.sectionTitle}>Language</h2>
        <p className={styles.sectionHint}>
          Sets the default language for questions and results. You can also change it per-session in the chat screen.
        </p>

        <div className={styles.toggle}>
          <button
            className={clsx(styles.toggleBtn, lang === 'es' && styles.toggleBtnActive)}
            onClick={() => select('es')}
          >
            ES — Español
          </button>
          <button
            className={clsx(styles.toggleBtn, lang === 'en' && styles.toggleBtnActive)}
            onClick={() => select('en')}
          >
            EN — English
          </button>
        </div>

        {saved && <p className={styles.savedMsg}>✓ Saved</p>}
      </section>
    </div>
  );
}
