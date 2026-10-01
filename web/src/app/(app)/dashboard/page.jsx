'use client';

import { DashboardView } from '@/components/Dashboard/DashboardView';
import { Protected } from '../protected';

export default function DashboardPage() {
  return (
    <Protected title="Beranda">
      <DashboardView />
    </Protected>
  );
}
