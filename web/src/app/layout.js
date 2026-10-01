import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from 'sonner';
import './globals.css';

export const metadata = {
  title: 'Task Reminder',
  description: 'Pengingat tugas kuliah dengan pelacakan jadwal, nilai, dan notifikasi.',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/favicon.ico', sizes: '16x16 24x24 32x32 48x48 64x64' },
      { url: '/icons/favicon-196.png', type: 'image/png', sizes: '196x196' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180' }],
  },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#3b82f6',
};

// Mirrors the client's main.jsx providers: ThemeProvider (light/dark/system)
// and sonner's Toaster. BrowserRouter is unnecessary here - the App Router
// supplies routing, and the react-router-dom shim maps onto it.
export default function RootLayout({ children }) {
  return (
    <html lang="id" suppressHydrationWarning>
      <body>
        <ThemeProvider defaultTheme="system" storageKey="task-reminder-theme">
          {children}
          <Toaster position="top-right" richColors closeButton />
        </ThemeProvider>
      </body>
    </html>
  );
}
