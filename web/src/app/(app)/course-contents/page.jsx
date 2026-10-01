'use client';

import { CourseContentView } from '@/components/CourseContent/CourseContentView';
import { Protected } from '../protected';

export default function CourseContentPage() {
  return (
    <Protected title="Mata Kuliah">
      <CourseContentView />
    </Protected>
  );
}
