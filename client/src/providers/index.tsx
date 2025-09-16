'use client';

import { Provider as JotaiProvider } from 'jotai';
import AuthProvider from './AuthProvider';
import ReactQueryProvider from './ReactQueryProvider';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <JotaiProvider>
      <ReactQueryProvider>
        <AuthProvider>{children}</AuthProvider>
      </ReactQueryProvider>
    </JotaiProvider>
  );
}