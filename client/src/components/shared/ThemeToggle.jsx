import { Laptop, Moon, Sun } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useTheme } from '@/components/theme-provider';

export function ThemeToggle() {
    const { theme, setTheme } = useTheme();

    const order = ['light', 'dark', 'system'];
    const themeLabels = {
        light: 'Terang',
        dark: 'Gelap',
        system: 'Sistem',
    };
    const currentIndex = order.indexOf(theme);
    const nextTheme = order[(currentIndex + 1) % order.length];

    const Icon =
        theme === 'light'
            ? Sun
            : theme === 'dark'
                ? Moon
                : Laptop;

    return (
        <Button
            variant="outline"
            size="icon"
            className="rounded-full"
            onClick={() => setTheme(nextTheme)}
            title={`Tema: ${themeLabels[theme] ?? theme}. Klik untuk beralih ke ${themeLabels[nextTheme] ?? nextTheme}.`}
        >
            <Icon className="h-4 w-4" />
            <span className="sr-only">Ganti tema</span>
        </Button>
    );
}
