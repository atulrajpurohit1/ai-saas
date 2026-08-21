'use client';

import { AuthProvider } from '@/context/AuthContext';
import { NetworkProvider } from '@/context/NetworkContext';
import { Toaster } from '@/components/ui/sonner';
import { ThemeProvider } from 'next-themes';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <AuthProvider>
        <NetworkProvider>
          {children}
          <Toaster position="top-right" />
        </NetworkProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
