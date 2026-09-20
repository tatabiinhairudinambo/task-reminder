import { format } from 'date-fns';
import { id as idLocale } from 'date-fns/locale';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import { getDeadlineBadgeClass } from '@/lib/tableUtils';

const formatDeadline = (value) => {
    if (!value) {
        return '-';
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return String(value);
    }

    return format(date, 'EEEE, d MMMM yyyy', { locale: idLocale });
};

export const TaskDetailDialog = ({ open, onOpenChange, task }) => {
    if (!task) {
        return null;
    }

    const isCompleted = Number(task.status) === 1;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>{task.task}</DialogTitle>
                    <DialogDescription>
                        {task.course_content || 'Mata kuliah'} · {task.semester || '-'}
                    </DialogDescription>
                </DialogHeader>

                <div className="flex flex-wrap gap-2">
                    <Badge
                        className={cn(
                            isCompleted
                                ? 'bg-success text-success-foreground hover:bg-success/80'
                                : 'bg-warning text-warning-foreground hover:bg-warning/80'
                        )}
                    >
                        {isCompleted ? 'Selesai' : 'Belum Selesai'}
                    </Badge>
                    {task.deadline_label ? (
                        <Badge className={cn(getDeadlineBadgeClass(task.deadline_label, task.status))}>
                            {task.deadline_label}
                        </Badge>
                    ) : null}
                    {task.priority ? (
                        <Badge className="bg-destructive text-destructive-foreground hover:bg-destructive/80">
                            Prioritas
                        </Badge>
                    ) : null}
                </div>

                <Separator />

                <dl className="space-y-3 text-sm">
                    <div className="flex flex-col gap-1">
                        <dt className="text-muted-foreground">Tenggat</dt>
                        <dd className="font-medium">{formatDeadline(task.deadline)}</dd>
                    </div>
                    <div className="flex flex-col gap-1">
                        <dt className="text-muted-foreground">Deskripsi</dt>
                        <dd className="whitespace-pre-line break-words">
                            {task.description?.trim() ? task.description : 'Tidak ada deskripsi.'}
                        </dd>
                    </div>
                </dl>
            </DialogContent>
        </Dialog>
    );
};
