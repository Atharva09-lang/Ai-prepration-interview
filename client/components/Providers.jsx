'use client';

import { MotionConfig } from 'framer-motion';
import { AuthProvider } from '@/hooks/useAuth';

export function Providers({ children }) {
  return (
    <MotionConfig reducedMotion="user">
      <AuthProvider>{children}</AuthProvider>
    </MotionConfig>
  );
}
