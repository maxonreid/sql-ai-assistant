'use client';
import { createContext, useContext, useEffect, useState } from 'react';

export type Lang = 'es' | 'en';
const LANG_KEY = 'sql-assistant:lang';

interface LangContextType { lang: Lang; setLang: (l: Lang) => void }
const LangContext = createContext<LangContextType>({ lang: 'es', setLang: () => {} });

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLangState] = useState<Lang>('es');

  // Restore persisted preference on first render.
  useEffect(() => {
    const stored = localStorage.getItem(LANG_KEY);
    if (stored === 'en' || stored === 'es') setLangState(stored);
  }, []);

  const setLang = (l: Lang) => {
    setLangState(l);
    localStorage.setItem(LANG_KEY, l);
  };

  return <LangContext.Provider value={{ lang, setLang }}>{children}</LangContext.Provider>;
}

export const useLang = () => useContext(LangContext);
