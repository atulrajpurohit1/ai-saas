'use client';

import { AuthProvider } from '@/context/AuthContext';
import { BrandingProvider } from '@/lib/branding';
import { ThemeProvider } from 'next-themes';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider attribute="class" defaultTheme="dark" enableSystem={false}>
      <AuthProvider>
        <BrandingProvider>
          {children}
        </BrandingProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}
