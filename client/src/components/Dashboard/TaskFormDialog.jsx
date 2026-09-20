import { useEffect, useState } from 'react';
import { Info } from 'lucide-react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { FormField } from '@/components/shared/FormField';
import useSemesterStore from '@/store/useSemesterStore';
import { SEMESTERS } from '@/lib/constants';
import { validateRequired } from '@/lib/formUtils';
import { DiscardConfirmDialog } from '@/components/shared/DiscardConfirmDialog';

export const TaskFormDialog = ({
    open,
    onOpenChange,
    mode = 'create',
    initialData,
    courseContents,
    onSemesterChange,
    onSubmit,
    isLoading,
}) => {
    const semesterLabel = useSemesterStore((state) => state.semesterLabel);
    const [semester, setSemester] = useState('');
    const [course, setCourse] = useState('');
    const [task, setTask] = useState('');
    const [description, setDescription] = useState('');
    const [deadline, setDeadline] = useState('');
    const [priority, setPriority] = useState(false);
    const [errors, setErrors] = useState({});
    const [showDiscard, setShowDiscard] = useState(false);

    const isDirty =
        mode === 'edit' && initialData
            ? semester !== (initialData.semester || '') ||
              course !== String(initialData.course_content_id || '') ||
              task !== (initialData.task || '') ||
              description !== (initialData.description || '') ||
              deadline !== (initialData.deadline || '') ||
              priority !== Boolean(initialData.priority)
            : course !== '' || task !== '' || description !== '' || deadline !== '' || priority;

    useEffect(() => {
        if (!open) {
            return;
        }

        if (mode === 'edit' && initialData) {
            setSemester(initialData.semester || '');
            setCourse(String(initialData.course_content_id || ''));
            setTask(initialData.task || '');
            setDescription(initialData.description || '');
            setDeadline(initialData.deadline || '');
            setPriority(Boolean(initialData.priority));
            if (initialData.semester) {
                onSemesterChange(initialData.semester);
            }
            return;
        }

        const defaultSemester = semesterLabel || 'Semester 1';
        setSemester(defaultSemester);
        setCourse('');
        setTask('');
        setDescription('');
        setDeadline('');
        setPriority(false);
        setErrors({});
        onSemesterChange(defaultSemester);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open, mode, initialData]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        const clientErrors = validateRequired(
            { course_content_id: course, task, deadline },
            [
                { name: 'course_content_id', label: 'Mata Kuliah' },
                { name: 'task', label: 'Tugas' },
                { name: 'deadline', label: 'Tenggat' },
            ]
        );
        if (Object.keys(clientErrors).length > 0) {
            setErrors({
                course_content: clientErrors.course_content_id,
                task: clientErrors.task,
                deadline: clientErrors.deadline,
            });
            return;
        }
        const payload = {
            course_content_id: course,
            task,
            description,
            deadline,
            priority,
        };

        const result = await onSubmit(payload, initialData?.id);
        if (result.success) {
            onOpenChange(false);
            return;
        }

        setErrors(result.errors || {});
    };

    const requestClose = () => {
        if (isDirty) {
            setShowDiscard(true);
            return;
        }

        onOpenChange(false);
    };

    const handleOpenChange = (nextOpen) => {
        if (!nextOpen && isDirty) {
            setShowDiscard(true);
            return;
        }

        onOpenChange(nextOpen);
    };

    return (
        <>
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent className="sm:max-w-xl" persistent>
                <DialogHeader>
                    <DialogTitle>{mode === 'create' ? 'Tambah Tugas Baru' : 'Ubah Tugas'}</DialogTitle>
                    <DialogDescription>Masukkan detail tugas yang ingin dikerjakan.</DialogDescription>
                </DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                    <FormField label="Semester" error={errors.semester}>
                        <Select
                            value={semester}
                            onValueChange={(value) => {
                                setSemester(value);
                                onSemesterChange(value);
                            }}
                        >
                            <SelectTrigger>
                                <SelectValue placeholder="Pilih semester" />
                            </SelectTrigger>
                            <SelectContent>
                                {SEMESTERS.map((item) => (
                                    <SelectItem key={item} value={item}>
                                        {item}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </FormField>

                    <FormField label="Mata Kuliah" error={errors.course_content}>
                        <Select value={course} onValueChange={setCourse}>
                            <SelectTrigger>
                                <SelectValue placeholder="Pilih mata kuliah" />
                            </SelectTrigger>
                            <SelectContent>
                                {[...courseContents]
                                    .sort((a, b) =>
                                        a.course_content.localeCompare(b.course_content, 'id', {
                                            sensitivity: 'base',
                                        })
                                    )
                                    .map((content) => (
                                        <SelectItem key={content.id} value={String(content.id)}>
                                            {content.course_content}
                                        </SelectItem>
                                    ))}
                            </SelectContent>
                        </Select>
                    </FormField>

                    <FormField label="Tugas" error={errors.task}>
                        <Input value={task} onChange={(e) => setTask(e.target.value)} placeholder="Masukkan nama tugas" required />
                    </FormField>

                    <FormField label="Deskripsi" error={errors.description}>
                        <Textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Masukkan deskripsi"
                            rows={6}
                        />
                    </FormField>

                    <FormField label="Tenggat" error={errors.deadline}>
                        <Input type="date" value={deadline} onChange={(e) => setDeadline(e.target.value)} required />
                    </FormField>

                    <div className="space-y-2">
                        <div className="flex items-center gap-2">
                            <label htmlFor="task-priority" className="cursor-pointer text-sm">
                                Prioritas
                            </label>
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <Info className="h-3 w-3" />
                                    </TooltipTrigger>
                                    <TooltipContent>Tugas ini akan dinotifikasi setiap hari.</TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </div>
                        <Checkbox
                            id="task-priority"
                            checked={priority}
                            onCheckedChange={(checked) => setPriority(checked === true)}
                        />
                        {errors.priority ? <p className="text-sm text-red-500">{errors.priority}</p> : null}
                    </div>

                    <DialogFooter>
                        <Button type="button" variant="outline" onClick={requestClose}>
                            Batal
                        </Button>
                        <Button type="submit" disabled={isLoading}>
                            {isLoading ? (mode === 'create' ? 'Menambahkan...' : 'Memperbarui...') : mode === 'create' ? 'Tambah' : 'Perbarui'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
            <DiscardConfirmDialog
                open={showDiscard}
                onOpenChange={setShowDiscard}
                onConfirm={() => {
                    setShowDiscard(false);
                    onOpenChange(false);
                }}
            />
        </>
    );
};
