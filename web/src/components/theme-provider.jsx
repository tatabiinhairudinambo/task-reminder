'use client';

import { createContext, useContext, useEffect, useState } from 'react';

const ThemeProviderContext = createContext({
    theme: 'system',
    setTheme: () => null,
});

export function ThemeProvider({
    children,
    defaultTheme = 'system',
    storageKey = 'task-reminder-theme',
    ...props
}) {
    // localStorage is unavailable during SSR; read it lazily in the browser.
    // The client SPA only ever mounted in the browser, so the stored value was
    // always available at first render there.
    const [theme, setTheme] = useState(() => {
        if (typeof window === 'undefined') return defaultTheme;
        return localStorage.getItem(storageKey) || defaultTheme;
    });

    useEffect(() => {
        const root = window.document.documentElement;
        root.classList.remove('light', 'dark');

        if (theme === 'system') {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            const systemTheme = mediaQuery.matches
                ? 'dark'
                : 'light';
            root.classList.add(systemTheme);

            const handler = (event) => {
                root.classList.remove('light', 'dark');
                root.classList.add(event.matches ? 'dark' : 'light');
            };

            mediaQuery.addEventListener('change', handler);
            return () => mediaQuery.removeEventListener('change', handler);
        }

        root.classList.add(theme);
    }, [theme]);

    const value = {
        theme,
        setTheme: (newTheme) => {
            if (typeof window !== 'undefined') {
                localStorage.setItem(storageKey, newTheme);
            }
            setTheme(newTheme);
        },
    };

    return (
        <ThemeProviderContext.Provider {...props} value={value}>
            {children}
        </ThemeProviderContext.Provider>
    );
}

export const useTheme = () => {
    const context = useContext(ThemeProviderContext);
    if (context === undefined) {
        throw new Error('useTheme must be used within a ThemeProvider');
    }
    return context;
};
