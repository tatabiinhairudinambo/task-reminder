import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TaskMonthCalendar } from './TaskMonthCalendar';

const tasks = [
    {
        id: 1,
        task: 'Midterm Exam',
        code: 'COURSE111',
        semester: 'Semester 1',
        deadline: '2026-09-25',
        deadline_label: '5 days left',
        priority: 0,
        status: 0,
    },
];

describe('TaskMonthCalendar', () => {
    it('shows the task name on the calendar badge', () => {
        render(<TaskMonthCalendar tasks={tasks} selectedDate={new Date(2026, 8, 25)} />);
        const badge = screen.getByText('Midterm Exam');
        expect(badge).toBeInTheDocument();
        expect(badge).toHaveAttribute('title', 'COURSE111 Midterm Exam');
    });

    it('calls onTaskSelect when a badge is clicked', () => {
        const onTaskSelect = vi.fn();
        render(
            <TaskMonthCalendar
                tasks={tasks}
                selectedDate={new Date(2026, 8, 25)}
                onTaskSelect={onTaskSelect}
            />
        );

        screen.getByText('Midterm Exam').click();
        expect(onTaskSelect).toHaveBeenCalledWith(tasks[0]);
    });

    it('falls back to the course code when a task has no name', () => {
        render(
            <TaskMonthCalendar
                tasks={[{ ...tasks[0], task: null }]}
                selectedDate={new Date(2026, 8, 25)}
            />
        );
        expect(screen.getByText('COURSE111')).toBeInTheDocument();
    });

    it('explains the empty calendar when there are no tasks', () => {
        render(<TaskMonthCalendar tasks={[]} selectedDate={new Date(2026, 8, 25)} />);

        expect(screen.getByText(/Belum ada tugas/)).toBeInTheDocument();
        expect(screen.getByText('Tugas Baru')).toBeInTheDocument();
    });

    it('hides the empty hint once a task exists', () => {
        render(<TaskMonthCalendar tasks={tasks} selectedDate={new Date(2026, 8, 25)} />);

        expect(screen.queryByText(/Belum ada tugas/)).not.toBeInTheDocument();
    });

    it('hides the empty hint while still loading', () => {
        render(<TaskMonthCalendar tasks={[]} isLoading selectedDate={new Date(2026, 8, 25)} />);

        expect(screen.queryByText(/Belum ada tugas/)).not.toBeInTheDocument();
    });
});
