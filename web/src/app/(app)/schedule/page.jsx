'use client';

import { useState } from 'react';
import { Protected } from '../protected';
import { WeeklySchedule } from '@/components/Schedule/WeeklySchedule';
import { CourseDetailDialog } from '@/components/shared/CourseDetailDialog';
import { useCourseContents } from '@/hooks/useCourseContents';
import useSemesterStore from '@/store/useSemesterStore';

// Port of pages/Schedule/Schedule.jsx (no dedicated view component existed).

export default function SchedulePage() {
  const selectedSemester = useSemesterStore((state) => state.semester);
  const { courseContents, isLoading } = useCourseContents(selectedSemester);
  const [selectedCourse, setSelectedCourse] = useState(null);

  return (
    <Protected title="Jadwal">
      <WeeklySchedule
        courseContents={courseContents}
        isLoading={isLoading}
        onCourseSelect={setSelectedCourse}
      />

      <CourseDetailDialog
        open={Boolean(selectedCourse)}
        onOpenChange={(nextOpen) => {
          if (!nextOpen) setSelectedCourse(null);
        }}
        course={selectedCourse}
      />
    </Protected>
  );
}
