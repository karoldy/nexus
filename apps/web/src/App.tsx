import { useEffect, useState } from 'react';
import { AppRouter } from '@/routers';
import { useAuthStore } from '@/stores/auth-store';

export default function App() {
  const [hydrated, setHydrated] = useState(() => useAuthStore.persist.hasHydrated());

  useEffect(() => {
    return useAuthStore.persist.onFinishHydration(() => {
      setHydrated(true);
    });
  }, []);

  if (!hydrated) {
    return <div className="min-h-svh bg-background" />;
  }

  return <AppRouter />;
}
