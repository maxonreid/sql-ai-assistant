'use client';
import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';
import { apiUrl } from '../../lib/api';
import { useLang } from '../../lib/language-context';
import type { Lang } from '../../lib/language-context';

const T = {
  es: {
    title:        'Configurar autenticación',
    step1:        '1. Abre Google Authenticator y escanea el código QR.',
    step2:        '2. Introduce el código de 6 dígitos para confirmar.',
    label:        'Código de confirmación',
    placeholder:  '000000',
    submit:       'Confirmar y continuar',
    verifying:    'Verificando…',
    loading:      'Generando código QR…',
    errorInvalid: 'Código incorrecto o expirado.',
    errorServer:  'Error del servidor. Inténtalo de nuevo.',
    lockoutTitle: 'Demasiados intentos fallidos',
    lockoutMsg:   'Acceso bloqueado. Inténtalo de nuevo en:',
  },
  en: {
    title:        'Set up authentication',
    step1:        '1. Open Google Authenticator and scan the QR code.',
    step2:        '2. Enter the 6-digit code to confirm.',
    label:        'Confirmation code',
    placeholder:  '000000',
    submit:       'Confirm and continue',
    verifying:    'Verifying…',
    loading:      'Generating QR code…',
    errorInvalid: 'Invalid or expired code.',
    errorServer:  'Server error. Please try again.',
    lockoutTitle: 'Too many failed attempts',
    lockoutMsg:   'Access locked. Try again in:',
  },
} as const;

export default function SetupPage() {
  const router = useRouter();
  const { lang, setLang } = useLang();
  const t = T[lang as Lang];

  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrError, setQrError]     = useState(false);
  const [code, setCode]           = useState('');
  const [status, setStatus]       = useState<'idle' | 'loading' | 'error' | 'locked'>('idle');
  const [errorMsg, setErrorMsg]   = useState('');
  const [lockedUntil, setLockedUntil] = useState(0);
  const [secsLeft, setSecsLeft]   = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);

  // Redirect away if setup already done
  useEffect(() => {
    fetch(apiUrl('/api/auth/status'))
      .then(r => r.json() as Promise<{ setupRequired: boolean }>)
      .then(({ setupRequired }) => { if (!setupRequired) router.replace('/login'); })
      .catch(() => {});
  }, [router]);

  // Load QR code
  useEffect(() => {
    fetch(apiUrl('/api/auth/setup'))
      .then(r => r.json() as Promise<{ qrDataUrl?: string; error?: string }>)
      .then(body => {
        if (body.qrDataUrl) {
          setQrDataUrl(body.qrDataUrl);
          setTimeout(() => inputRef.current?.focus(), 0);
        } else {
          setQrError(true);
        }
      })
      .catch(() => setQrError(true));
  }, []);

  // Countdown ticker while locked
  useEffect(() => {
    if (status !== 'locked') return;
    setSecsLeft(Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000)));
    const id = setInterval(() => {
      const s = Math.ceil((lockedUntil - Date.now()) / 1000);
      if (s <= 0) {
        setStatus('idle');
        setCode('');
        clearInterval(id);
        setTimeout(() => inputRef.current?.focus(), 0);
      } else {
        setSecsLeft(s);
      }
    }, 1000);
    return () => clearInterval(id);
  }, [status, lockedUntil]);

  const confirm = async (token: string) => {
    setStatus('loading');
    setErrorMsg('');

    try {
      const res = await fetch(apiUrl('/api/auth/setup/confirm'), {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({ token }),
      });

      const body = await res.json() as { ok: boolean; error?: string; lockedUntil?: number };

      if (body.ok) {
        router.replace('/login');
        return;
      }

      if (res.status === 429 && body.lockedUntil) {
        setLockedUntil(body.lockedUntil);
        setStatus('locked');
        setCode('');
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
    if (val.length === 6) confirm(val);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length === 6 && status !== 'loading') confirm(code);
  };

  const fmtCountdown = (s: number) => {
    const m = Math.floor(s / 60);
    const sec = String(s % 60).padStart(2, '0');
    return `${m}:${sec}`;
  };

  const isLoading = status === 'loading';
  const isLocked  = status === 'locked';

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
        <h1 className={styles.title}>{t.title}</h1>

        {/* QR code */}
        <div className={styles.qrWrap}>
          {qrDataUrl ? (
            <img src={qrDataUrl} alt="TOTP QR code" width={200} height={200} />
          ) : qrError ? (
            <p className={styles.qrError}>{t.errorServer}</p>
          ) : (
            <p className={styles.qrLoading}>{t.loading}</p>
          )}
        </div>

        <ol className={styles.steps}>
          <li>{t.step1}</li>
          <li>{t.step2}</li>
        </ol>

        {isLocked ? (
          <div className={styles.lockout} role="alert" aria-live="polite">
            <p className={styles.lockoutTitle}>{t.lockoutTitle}</p>
            <p className={styles.lockoutMsg}>{t.lockoutMsg}</p>
            <p className={styles.countdown}>{fmtCountdown(secsLeft)}</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} noValidate>
            <label className={styles.label} htmlFor="setup-code">
              {t.label}
            </label>
            <input
              ref={inputRef}
              id="setup-code"
              className={`${styles.input} ${status === 'error' ? styles.inputError : ''}`}
              type="text"
              inputMode="numeric"
              pattern="[0-9]*"
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={handleChange}
              disabled={isLoading || !qrDataUrl}
              placeholder={t.placeholder}
              aria-invalid={status === 'error'}
              aria-describedby={status === 'error' ? 'setup-error' : undefined}
            />

            {status === 'error' && (
              <p id="setup-error" className={styles.error} role="alert">
                {errorMsg}
              </p>
            )}

            <button
              className={styles.submit}
              type="submit"
              disabled={code.length < 6 || isLoading || !qrDataUrl}
            >
              {isLoading ? t.verifying : t.submit}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
