import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CourseDetailDialog } from './CourseDetailDialog';

const baseCourse = {
    id: 5,
    code: 'COURSE114',
    course_content: 'Basic Networking',
    semester: 'Semester 1',
    lecturer: 'Dr. Budi',
    credits: 3,
    day: 'Senin',
    hour_start: '08:00',
    hour_end: '10:00',
    tasks: [
        {
            id: 1,
            task: 'Tugas Jaringan',
            description: 'Analisis paket',
            deadline: '2026-10-01',
            deadline_label: '11 days left',
            priority: 1,
            status: 0,
        },
        {
            id: 2,
            task: 'Kuis Subnetting',
            description: null,
            deadline: '2026-09-15',
            deadline_label: 'Completed',
            priority: 0,
            status: 1,
        },
    ],
};

const renderDialog = (props = {}) =>
    render(<CourseDetailDialog open onOpenChange={() => {}} course={baseCourse} {...props} />);

describe('CourseDetailDialog', () => {
    it('renders nothing without a course', () => {
        const { container } = render(<CourseDetailDialog open onOpenChange={() => {}} course={null} />);
        expect(container).toBeEmptyDOMElement();
    });

    it('shows course metadata', () => {
        renderDialog();
        expect(screen.getByText('Basic Networking')).toBeInTheDocument();
        expect(screen.getByText('COURSE114 · Semester 1')).toBeInTheDocument();
        expect(screen.getByText('Dr. Budi')).toBeInTheDocument();
        expect(screen.getByText('Senin · 08:00 - 10:00')).toBeInTheDocument();
        expect(screen.getByText('3 SKS')).toBeInTheDocument();
    });

    it('shows task counter and lists each task', () => {
        renderDialog();
        expect(screen.getByText('2 total · 1 belum selesai')).toBeInTheDocument();
        expect(screen.getByText('Tugas Jaringan')).toBeInTheDocument();
        expect(screen.getByText('Kuis Subnetting')).toBeInTheDocument();
        expect(screen.getByText('Analisis paket')).toBeInTheDocument();
        expect(screen.getByText('Prioritas')).toBeInTheDocument();
        expect(screen.getByText('11 days left')).toBeInTheDocument();
    });

    it('shows an empty state when the course has no tasks', () => {
        renderDialog({ course: { ...baseCourse, tasks: [] } });
        expect(screen.getByText('Belum ada tugas untuk mata kuliah ini.')).toBeInTheDocument();
        expect(screen.getByText('0 total · 0 belum selesai')).toBeInTheDocument();
    });

    it('tolerates a missing tasks field', () => {
        const withoutTasks = { ...baseCourse };
        delete withoutTasks.tasks;
        renderDialog({ course: withoutTasks });
        expect(screen.getByText('Belum ada tugas untuk mata kuliah ini.')).toBeInTheDocument();
    });
});
