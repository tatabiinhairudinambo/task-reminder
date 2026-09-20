import { useEffect, useState } from 'react';
import { AppLayout } from '@/components/layout/AppLayout';
import { WeeklySchedule } from '@/components/Schedule/WeeklySchedule';
import { CourseDetailDialog } from '@/components/shared/CourseDetailDialog';
import { useCourseContents } from '@/hooks/useCourseContents';
import useSemesterStore from '@/store/useSemesterStore';

const Schedule = () => {
    const selectedSemester = useSemesterStore((state) => state.semester);
    const { courseContents, isLoading } = useCourseContents(selectedSemester);
    const [selectedCourse, setSelectedCourse] = useState(null);

    useEffect(() => {
        document.title = 'Jadwal - Task Reminder';
    }, []);

    return (
        <AppLayout title="Jadwal">
            <WeeklySchedule
                courseContents={courseContents}
                isLoading={isLoading}
                onCourseSelect={setSelectedCourse}
            />

            <CourseDetailDialog
                open={Boolean(selectedCourse)}
                onOpenChange={(nextOpen) => {
                    if (!nextOpen) {
                        setSelectedCourse(null);
                    }
                }}
                course={selectedCourse}
            />
        </AppLayout>
    );
};

export default Schedule;
