import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { LangProvider, useLang } from '../../lib/language-context';

function LangDisplay() {
  const { lang } = useLang();
  return <span data-testid="lang">{lang}</span>;
}

function LangSwitcher() {
  const { lang, setLang } = useLang();
  return (
    <>
      <span data-testid="lang">{lang}</span>
      <button onClick={() => setLang(lang === 'es' ? 'en' : 'es')}>toggle</button>
    </>
  );
}

beforeEach(() => {
  localStorage.clear();
});

describe('LangProvider', () => {
  it('defaults to "es" when nothing is stored', () => {
    render(<LangProvider><LangDisplay /></LangProvider>);
    expect(screen.getByTestId('lang').textContent).toBe('es');
  });

  it('restores a persisted "en" preference from localStorage', () => {
    localStorage.setItem('sql-assistant:lang', 'en');
    render(<LangProvider><LangDisplay /></LangProvider>);
    // The useEffect fires after mount; check after the update
    expect(screen.getByTestId('lang').textContent).toBe('en');
  });

  it('updates lang and persists it when setLang is called', () => {
    render(<LangProvider><LangSwitcher /></LangProvider>);
    const btn = screen.getByRole('button', { name: 'toggle' });
    fireEvent.click(btn);
    expect(screen.getByTestId('lang').textContent).toBe('en');
    expect(localStorage.getItem('sql-assistant:lang')).toBe('en');
  });

  it('toggles back to "es" on a second click', () => {
    render(<LangProvider><LangSwitcher /></LangProvider>);
    const btn = screen.getByRole('button', { name: 'toggle' });
    fireEvent.click(btn);
    fireEvent.click(btn);
    expect(screen.getByTestId('lang').textContent).toBe('es');
    expect(localStorage.getItem('sql-assistant:lang')).toBe('es');
  });
});

describe('useLang outside provider', () => {
  it('returns the context default (lang: "es") when no provider wraps the tree', () => {
    render(<LangDisplay />);
    expect(screen.getByTestId('lang').textContent).toBe('es');
  });
});
