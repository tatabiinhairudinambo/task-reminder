'use client';

import { AssessmentView } from '@/components/Assessment/AssessmentView';
import { Protected } from '../protected';

export default function AssessmentPage() {
  return (
    <Protected title="Penilaian">
      <AssessmentView />
    </Protected>
  );
}
