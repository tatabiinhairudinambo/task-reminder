import { cn } from '@/lib/utils';

export const ScheduleCourseBlock = ({ course, style, overlapIndex, overlapTotal, onSelect }) => {
    const width = 100 / Math.max(overlapTotal, 1);
    const left = overlapIndex * width;
    const taskCount = Array.isArray(course.tasks) ? course.tasks.length : 0;

    return (
        <button
            type="button"
            onClick={() => onSelect?.(course)}
            className={cn(
                'absolute overflow-hidden rounded-md border border-primary/30 bg-primary/20 p-2 text-left text-xs text-foreground shadow-sm',
                'cursor-pointer transition-colors hover:bg-primary/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring'
            )}
            style={{
                ...style,
                left: `calc(${left}% + 2px)`,
                width: `calc(${width}% - 4px)`,
            }}
            title={`${course.course_content} (${course.hour_start} - ${course.hour_end})`}
        >
            <p className="truncate text-[11px] font-semibold text-primary">
                {course.hour_start} - {course.hour_end}
            </p>
            <p className="mt-1 line-clamp-2 text-[11px] font-medium">{course.course_content}</p>
            {taskCount > 0 ? (
                <p className="mt-1 text-[10px] text-primary/80">
                    {taskCount} tugas
                </p>
            ) : null}
        </button>
    );
};
