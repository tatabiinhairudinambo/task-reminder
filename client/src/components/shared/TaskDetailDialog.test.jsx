import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TaskDetailDialog } from './TaskDetailDialog';

const baseTask = {
    id: 1,
    task: 'Midterm Exam',
    course_content: 'Kalkulus',
    semester: 'Semester 1',
    deadline: '2026-09-26',
    deadline_label: '6 hari lagi',
    description: 'Bawa kalkulator',
    priority: 0,
    status: 0,
};

const renderDialog = (props = {}) =>
    render(<TaskDetailDialog open onOpenChange={vi.fn()} task={baseTask} {...props} />);

describe('TaskDetailDialog', () => {
    it('renders nothing without a task', () => {
        const { container } = render(<TaskDetailDialog open onOpenChange={vi.fn()} task={null} />);
        expect(container).toBeEmptyDOMElement();
    });

    it('shows task name, course, semester and description', () => {
        renderDialog();
        expect(screen.getByText('Midterm Exam')).toBeInTheDocument();
        expect(screen.getByText('Kalkulus · Semester 1')).toBeInTheDocument();
        expect(screen.getByText('Bawa kalkulator')).toBeInTheDocument();
        expect(screen.getByText('Belum Selesai')).toBeInTheDocument();
        expect(screen.getByText('6 hari lagi')).toBeInTheDocument();
    });

    it('flags priority tasks', () => {
        renderDialog({ task: { ...baseTask, priority: 1 } });
        expect(screen.getByText('Prioritas')).toBeInTheDocument();
    });

    it('marks completed tasks', () => {
        renderDialog({ task: { ...baseTask, status: 1, deadline_label: 'Selesai' } });
        expect(screen.getAllByText('Selesai')).toHaveLength(2);
        expect(screen.queryByText('Belum Selesai')).not.toBeInTheDocument();
    });

    it('falls back when description is empty', () => {
        renderDialog({ task: { ...baseTask, description: '   ' } });
        expect(screen.getByText('Tidak ada deskripsi.')).toBeInTheDocument();
    });

    it('calls onOpenChange(false) when closed', () => {
        const onOpenChange = vi.fn();
        renderDialog({ onOpenChange });
        fireEvent.click(screen.getByRole('button', { name: 'Close' }));
        expect(onOpenChange).toHaveBeenCalledWith(false);
    });
});
