'use client';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';
import { apiUrl } from '../../lib/api';
import { useLang } from '../../lib/language-context';

const T = {
  es: {
    title:       'SQL Assistant',
    subtitle:    'Introduce el código de tu aplicación de autenticación.',
    label:       'Código de 6 dígitos',
    placeholder: '000000',
    submit:      'Entrar',
    verifying:   'Verificando…',
    errorInvalid:'Código incorrecto o expirado.',
    errorServer: 'Error del servidor. Inténtalo de nuevo.',
  },
  en: {
    title:       'SQL Assistant',
    subtitle:    'Enter the code from your authenticator app.',
    label:       '6-digit code',
    placeholder: '000000',
    submit:      'Sign in',
    verifying:   'Verifying…',
    errorInvalid:'Invalid or expired code.',
    errorServer: 'Server error. Please try again.',
  },
} as const;

type Lang = keyof typeof T;

export default function LoginPage() {
  const router = useRouter();

  const { lang, setLang } = useLang();
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const t = T[lang as Lang];

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  // Skip login if already authenticated this session
  useEffect(() => {
    if (sessionStorage.getItem('sql-assistant:authed') === '1') {
      router.replace('/chat');
    }
  }, [router]);

  const verify = async (token: string) => {
    setStatus('loading');
    setErrorMsg('');

    try {
      const res = await fetch(apiUrl('/api/auth/verify'), {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ token }),
      });

      const body = await res.json() as { ok: boolean; error?: string };

      if (body.ok) {
        sessionStorage.setItem('sql-assistant:authed', '1');
        router.replace('/chat');
        return;
      }

      setErrorMsg(res.status === 401 ? t.errorInvalid : (body.error ?? t.errorServer));
      setStatus('error');
      setCode('');
      inputRef.current?.focus();
    } catch {
      setErrorMsg(t.errorServer);
      setStatus('error');
      setCode('');
      inputRef.current?.focus();
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 6);
    setCode(val);
    if (status === 'error') setStatus('idle');
    if (val.length === 6) verify(val);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length === 6 && status !== 'loading') verify(code);
  };

  const isLoading = status === 'loading';

  return (
    <div className={styles.page}>
      <div className={styles.langToggle}>
        <button
          className={lang === 'es' ? styles.langActive : styles.langBtn}
          onClick={() => setLang('es')}
          type="button"
        >ES</button>
        <button
          className={lang === 'en' ? styles.langActive : styles.langBtn}
          onClick={() => setLang('en')}
          type="button"
        >EN</button>
      </div>

      <div className={styles.card}>
        <div className={styles.lockIcon} aria-hidden="true">🔐</div>
        <h1 className={styles.title}>{t.title}</h1>
        <p className={styles.subtitle}>{t.subtitle}</p>

        <form onSubmit={handleSubmit} noValidate>
          <label className={styles.label} htmlFor="totp-input">
            {t.label}
          </label>
          <input
            ref={inputRef}
            id="totp-input"
            className={`${styles.input} ${status === 'error' ? styles.inputError : ''}`}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="one-time-code"
            maxLength={6}
            value={code}
            onChange={handleChange}
            disabled={isLoading}
            placeholder={t.placeholder}
            aria-invalid={status === 'error'}
            aria-describedby={status === 'error' ? 'totp-error' : undefined}
          />

          {status === 'error' && (
            <p id="totp-error" className={styles.error} role="alert">
              {errorMsg}
            </p>
          )}

          <button
            className={styles.submit}
            type="submit"
            disabled={code.length < 6 || isLoading}
          >
            {isLoading ? t.verifying : t.submit}
          </button>
        </form>
      </div>
    </div>
  );
}
