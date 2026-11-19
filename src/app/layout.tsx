import type { Metadata } from 'next';
import { Geist, Geist_Mono } from 'next/font/google';
import './globals.css';
import { AuthProvider } from '@/context/AuthContext';
import { ToastProvider } from '@/context/ToastContext';
import { NavProvider } from '@/context/NavContext';

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
});

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
});

export const metadata: Metadata = {
  title: 'Maintenance Module',
  description: 'Garment Factory Maintenance & Asset Management Suite (Next.js 16, MongoDB & QR Tooling)',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="plant-command min-h-full flex flex-col bg-slate-100 text-slate-800">
        <AuthProvider>
          <NavProvider>
            <ToastProvider>{children}</ToastProvider>
          </NavProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
