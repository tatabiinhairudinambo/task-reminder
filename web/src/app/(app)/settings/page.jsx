'use client';

import { SettingsView } from '@/components/Settings/SettingsView';
import { Protected } from '../protected';

export default function SettingsPage() {
  return (
    <Protected title="Pengaturan">
      <SettingsView />
    </Protected>
  );
}
