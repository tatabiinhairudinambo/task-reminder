'use client';

import { useEffect } from 'react';
import { DashboardView } from '@/components/Dashboard/DashboardView';
import { Protected } from '../protected';

export default function DashboardPage() {
  useEffect(() => {
    document.title = 'Beranda - Task Reminder';
  }, []);

  return (
    <Protected title="Beranda">
      <DashboardView />
    </Protected>
  );
}
