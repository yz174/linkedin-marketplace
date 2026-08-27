'use client';

import { StatusFrame } from '@lm/contracts';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

const SETTLE_MS = 200;

export function LiveCollabs({ side }: { side: 'brand' | 'creator' }) {
  const router = useRouter();

  useEffect(() => {
    const source = new EventSource(`/bff/${side}/events`);
    let settle: ReturnType<typeof setTimeout> | null = null;

    source.addEventListener('collab_changed', (event) => {
      let raw: unknown;
      try {
        raw = JSON.parse((event as MessageEvent<string>).data);
      } catch {
        return;
      }
      if (!StatusFrame.safeParse(raw).success) return;

      if (settle) clearTimeout(settle);
      settle = setTimeout(() => router.refresh(), SETTLE_MS);
    });

    return () => {
      if (settle) clearTimeout(settle);
      source.close();
    };
  }, [side, router]);

  return null;
}
