import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CourseContentFormDialog } from './CourseContentFormDialog';
import useSemesterStore from '@/store/useSemesterStore';

const renderDialog = (props = {}) =>
    render(
        <CourseContentFormDialog
            open
            onOpenChange={vi.fn()}
            mode="create"
            initialData={null}
            isLoading={false}
            onSubmit={vi.fn()}
            {...props}
        />
    );

const semesterTrigger = () => screen.getAllByRole('combobox')[0];

describe('CourseContentFormDialog semester default', () => {
    beforeEach(() => {
        localStorage.clear();
        useSemesterStore.setState({ semester: 'Semester 1', semesterLabel: 'Semester 1', userName: '' });
    });

    it('defaults to the semester currently selected in the header', () => {
        useSemesterStore.setState({ semester: 'Semester 3', semesterLabel: 'Semester 3' });
        renderDialog();

        // The select trigger renders the chosen semester as its text content.
        expect(semesterTrigger()).toHaveTextContent('Semester 3');
    });

    it('falls back to Semester 1 when the store has no semester', () => {
        useSemesterStore.setState({ semester: '', semesterLabel: '' });
        renderDialog();

        expect(semesterTrigger()).toHaveTextContent('Semester 1');
    });

    it('uses the course semester when editing, not the header selection', () => {
        useSemesterStore.setState({ semester: 'Semester 1', semesterLabel: 'Semester 1' });
        renderDialog({
            mode: 'edit',
            initialData: {
                id: 9,
                semester: 'Semester 5',
                code: 'MK009',
                course_content: 'Basis Data',
                credits: 3,
                lecturer: 'Dr. Uji',
                day: 'Rabu',
                hour_start: '08:00',
                hour_end: '10:00',
            },
        });

        expect(semesterTrigger()).toHaveTextContent('Semester 5');
    });
});
