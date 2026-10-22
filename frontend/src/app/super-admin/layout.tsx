'use client';

import React from 'react';
import { PlatformAuthProvider } from '@/context/PlatformAuthContext';

/**
 * Wraps the whole /super-admin subtree -- console and login page alike -- in
 * the platform session, and nothing else.
 *
 * The customer app's DashboardLayout (tenant sidebar, module nav, branding) is
 * deliberately absent: this is a separate product surface that happens to be
 * served from the same domain, not a page of the tenant app. The login page
 * lives inside this provider too, because it needs the same session in order
 * to know whether the operator is already signed in.
 */
export default function SuperAdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PlatformAuthProvider>{children}</PlatformAuthProvider>;
}
