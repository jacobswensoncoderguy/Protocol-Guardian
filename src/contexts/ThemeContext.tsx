import { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type PgTheme = 'obsidian' | 'clinic' | 'neon' | 'carbon';

interface ThemeContextValue {
  theme: PgTheme;
  setTheme: (t: PgTheme) => void;
}

const ThemeContext = createContext<ThemeContextValue>({
  theme: 'obsidian',
  setTheme: () => {},
});

export function usePageTheme() {
  return useContext(ThemeContext);
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<PgTheme>(() => {
    if (typeof window === 'undefined') return 'obsidian';
    const stored = localStorage.getItem('pg_theme');
    if (stored === 'obsidian' || stored === 'clinic' || stored === 'neon' || stored === 'carbon') return stored;
    return 'obsidian';
  });

  const setTheme = (t: PgTheme) => {
    setThemeState(t);
    localStorage.setItem('pg_theme', t);
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      <div className={`theme-${theme}`} style={{ background: 'var(--pg-bg)', color: 'var(--pg-text-primary)', borderRadius: 'var(--pg-radius)', minHeight: '100%' }}>
        {children}
      </div>
    </ThemeContext.Provider>
  );
}

export function ThemeSelector() {
  const { theme, setTheme } = usePageTheme();
  const options: { key: PgTheme; label: string }[] = [
    { key: 'obsidian', label: 'Atlas' },
    { key: 'clinic', label: 'Clinic' },
    { key: 'neon', label: 'Neon' },
    { key: 'carbon', label: 'Carbon' },
  ];

  return (
    <div className="flex gap-1">
      {options.map(o => (
        <button
          key={o.key}
          onClick={() => setTheme(o.key)}
          className="px-2.5 py-1 rounded-full text-[10px] font-medium transition-all"
          style={{
            background: theme === o.key ? 'var(--pg-accent)' : 'var(--pg-card)',
            color: theme === o.key ? (o.key === 'clinic' ? '#fff' : 'var(--pg-bg)') : 'var(--pg-text-secondary)',
            border: `1px solid ${theme === o.key ? 'var(--pg-accent)' : 'var(--pg-card-border)'}`,
          }}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
