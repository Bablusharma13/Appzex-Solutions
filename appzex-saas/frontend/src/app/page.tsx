'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { FullPageLoader } from '@/components/layout/role-gate';
import { useCurrentUser } from '@/hooks/use-auth';

/** Entry point: send the user to their role's home, or to sign in. */
export default function HomePage() {
  const { data: profile, isLoading } = useCurrentUser();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) return;
    router.replace(profile ? profile.home : '/login');
  }, [isLoading, profile, router]);

  return <FullPageLoader label="Opening AppZex…" />;
}
