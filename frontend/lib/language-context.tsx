'use client';
import { createContext, useContext, useState } from 'react';

interface LangContextType { lang: string; setLang: (l: string) => void }
const LangContext = createContext<LangContextType>({ lang: 'es', setLang: () => {} });

export function LangProvider({ children }: { children: React.ReactNode }) {
  const [lang, setLang] = useState('es');
  return <LangContext.Provider value={{ lang, setLang }}>{children}</LangContext.Provider>;
}

export const useLang = () => useContext(LangContext);