import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ar, type Dict } from './ar';
import { en } from './en';

export type Lang = 'ar' | 'en';

interface I18nValue {
  lang: Lang;
  dir: 'rtl' | 'ltr';
  t: Dict;
  setLang: (lang: Lang) => void;
  toggleLang: () => void;
  /** Picks the localized variant of a bilingual DB record, falling back to the other language. */
  pick: (arValue?: string | null, enValue?: string | null) => string | null;
}

const STORAGE_KEY = 'aq-lang';
const dictionaries: Record<Lang, Dict> = { ar, en };

const I18nContext = createContext<I18nValue | null>(null);

function initialLang(): Lang {
  try {
    return localStorage.getItem(STORAGE_KEY) === 'en' ? 'en' : 'ar';
  } catch {
    return 'ar';
  }
}

export function I18nProvider({ children, defaultLang }: { children: ReactNode; defaultLang?: Lang }) {
  const [lang, setLangState] = useState<Lang>(() => defaultLang ?? initialLang());

  useEffect(() => {
    const root = document.documentElement;
    root.lang = lang;
    root.dir = lang === 'ar' ? 'rtl' : 'ltr';
    try {
      localStorage.setItem(STORAGE_KEY, lang);
    } catch {
      /* storage unavailable */
    }
  }, [lang]);

  const setLang = useCallback((l: Lang) => setLangState(l), []);
  const toggleLang = useCallback(() => setLangState((l) => (l === 'ar' ? 'en' : 'ar')), []);

  const value = useMemo<I18nValue>(
    () => ({
      lang,
      dir: lang === 'ar' ? 'rtl' : 'ltr',
      t: dictionaries[lang],
      setLang,
      toggleLang,
      pick: (a, e) => (lang === 'ar' ? a || e : e || a) || null,
    }),
    [lang, setLang, toggleLang],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error('useI18n must be used inside I18nProvider');
  return ctx;
}
