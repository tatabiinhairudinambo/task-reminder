import { ThemeProvider } from '@/components/theme-provider';
import { Toaster } from 'sonner';
import Script from 'next/script';
import './globals.css';

// Mirrors client/index.html head: favicons, PWA manifest, Apple web-app meta
// and all 40 apple-touch-startup-image splashes with their media queries.
// The /icons/ directory is served from web/public/icons (copied byte-exact
// from client/public/icons).

const APPLE_SPLASHES = [
  ['1125-2436', '375px', '812px', '3', 'portrait'],
  ['1136-640', '568px', '320px', '2', 'landscape'],
  ['1170-2532', '390px', '844px', '3', 'portrait'],
  ['1179-2556', '393px', '852px', '3', 'portrait'],
  ['1206-2622', '402px', '874px', '3', 'portrait'],
  ['1242-2208', '414px', '736px', '3', 'portrait'],
  ['1242-2688', '414px', '896px', '3', 'portrait'],
  ['1260-2736', '420px', '912px', '3', 'portrait'],
  ['1284-2778', '428px', '926px', '3', 'portrait'],
  ['1290-2796', '430px', '932px', '3', 'portrait'],
  ['1320-2868', '440px', '956px', '3', 'portrait'],
  ['1334-750', '667px', '375px', '2', 'landscape'],
  ['1488-2266', '744px', '1133px', '2', 'portrait'],
  ['1536-2048', '768px', '1024px', '2', 'portrait'],
  ['1620-2160', '810px', '1080px', '2', 'portrait'],
  ['1640-2360', '820px', '1180px', '2', 'portrait'],
  ['1668-2224', '834px', '1112px', '2', 'portrait'],
  ['1668-2388', '834px', '1194px', '2', 'portrait'],
  ['1792-828', '896px', '414px', '2', 'landscape'],
  ['2048-1536', '1024px', '768px', '2', 'landscape'],
  ['2048-2732', '1024px', '1366px', '2', 'portrait'],
  ['2160-1620', '1080px', '810px', '2', 'landscape'],
  ['2208-1242', '736px', '414px', '3', 'landscape'],
  ['2224-1668', '1112px', '834px', '2', 'landscape'],
  ['2266-1488', '1133px', '744px', '2', 'landscape'],
  ['2360-1640', '1180px', '820px', '2', 'landscape'],
  ['2388-1668', '1194px', '834px', '2', 'landscape'],
  ['2436-1125', '812px', '375px', '3', 'landscape'],
  ['2532-1170', '844px', '390px', '3', 'landscape'],
  ['2556-1179', '852px', '393px', '3', 'landscape'],
  ['2622-1206', '874px', '402px', '3', 'landscape'],
  ['2688-1242', '896px', '414px', '3', 'landscape'],
  ['2732-2048', '1366px', '1024px', '2', 'landscape'],
  ['2736-1260', '912px', '420px', '3', 'landscape'],
  ['2778-1284', '926px', '428px', '3', 'landscape'],
  ['2796-1290', '932px', '430px', '3', 'landscape'],
  ['2868-1320', '956px', '440px', '3', 'landscape'],
  ['640-1136', '320px', '568px', '2', 'portrait'],
  ['750-1334', '375px', '667px', '2', 'portrait'],
  ['828-1792', '414px', '896px', '2', 'portrait'],
];

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
    other: APPLE_SPLASHES.map(([name, width, height, ratio, orientation]) => ({
      rel: 'apple-touch-startup-image',
      url: `/icons/apple-splash-${name}.jpg`,
      media: `(device-width: ${width}) and (device-height: ${height}) and (-webkit-device-pixel-ratio: ${ratio}) and (orientation: ${orientation})`,
    })),
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Task Reminder',
  },
  other: {
    'mobile-web-app-capable': 'yes',
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
        <Script
          defer
          src="https://umami.mohfer.my.id/script.js"
          data-website-id="0cebcffe-5947-4d0f-90aa-554cc01c3384"
          strategy="afterInteractive"
        />
      </body>
    </html>
  );
}
