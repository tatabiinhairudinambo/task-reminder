import { CalendarClock, GraduationCap, User } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { getDeadlineBadgeClass } from '@/lib/tableUtils';

const formatDeadline = (value) => {
    if (!value) {
        return '-';
    }

    return String(value);
};

export const CourseDetailDialog = ({ open, onOpenChange, course }) => {
    if (!course) {
        return null;
    }

    const tasks = Array.isArray(course.tasks) ? course.tasks : [];
    const uncompleted = tasks.filter((task) => Number(task.status) !== 1).length;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-xl">
                <DialogHeader>
                    <DialogTitle>{course.course_content}</DialogTitle>
                    <DialogDescription>
                        {course.code} · {course.semester || '-'}
                    </DialogDescription>
                </DialogHeader>

                <div className="grid gap-3 text-sm sm:grid-cols-2">
                    <div className="flex items-center gap-2">
                        <User className="h-4 w-4 text-muted-foreground" />
                        <span>{course.lecturer || 'Dosen belum diisi'}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <CalendarClock className="h-4 w-4 text-muted-foreground" />
                        <span>
                            {course.day || '-'} · {course.hour_start || '--:--'} - {course.hour_end || '--:--'}
                        </span>
                    </div>
                    <div className="flex items-center gap-2">
                        <GraduationCap className="h-4 w-4 text-muted-foreground" />
                        <span>{course.credits ?? 0} SKS</span>
                    </div>
                </div>

                <Separator />

                <div className="space-y-2">
                    <div className="flex items-center justify-between">
                        <p className="text-sm font-semibold">Tugas</p>
                        <span className="text-xs text-muted-foreground">
                            {tasks.length} total · {uncompleted} belum selesai
                        </span>
                    </div>

                    {tasks.length === 0 ? (
                        <p className="rounded-md border border-dashed p-3 text-sm text-muted-foreground">
                            Belum ada tugas untuk mata kuliah ini.
                        </p>
                    ) : (
                        <ul className="max-h-64 space-y-2 overflow-y-auto pr-1">
                            {tasks.map((task) => (
                                <li key={task.id} className="rounded-md border p-3">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="text-sm font-medium">{task.task}</span>
                                        {task.priority ? (
                                            <Badge className="bg-destructive text-destructive-foreground hover:bg-destructive/80">
                                                Prioritas
                                            </Badge>
                                        ) : null}
                                    </div>
                                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                                        <span>{formatDeadline(task.deadline)}</span>
                                        <Badge className={cn(getDeadlineBadgeClass(task.deadline_label, task.status))}>
                                            {task.deadline_label}
                                        </Badge>
                                    </div>
                                    {task.description?.trim() ? (
                                        <p className="mt-2 whitespace-pre-line break-words text-xs text-muted-foreground">
                                            {task.description}
                                        </p>
                                    ) : null}
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </DialogContent>
        </Dialog>
    );
};
