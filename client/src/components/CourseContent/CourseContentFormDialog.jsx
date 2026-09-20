import { useEffect, useState } from 'react';
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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { FormField } from '@/components/shared/FormField';
import { SEMESTERS } from '@/lib/constants';
import { getFieldError, validateRequired } from '@/lib/formUtils';
import { DiscardConfirmDialog } from '@/components/shared/DiscardConfirmDialog';
import useSemesterStore from '@/store/useSemesterStore';

const DAYS = ['Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu', 'Minggu'];

export const CourseContentFormDialog = ({
    open,
    onOpenChange,
    mode,
    initialData,
    isLoading,
    onSubmit,
}) => {
    const selectedSemester = useSemesterStore((state) => state.semester);
    const [semester, setSemester] = useState('');
    const [code, setCode] = useState('');
    const [courseContent, setCourseContent] = useState('');
    const [credits, setCredits] = useState('');
    const [lecturer, setLecturer] = useState('');
    const [day, setDay] = useState('');
    const [hourStart, setHourStart] = useState('');
    const [hourEnd, setHourEnd] = useState('');
    const [errors, setErrors] = useState({});
    const [showDiscard, setShowDiscard] = useState(false);

    const isDirty =
        mode === 'edit' && initialData
            ? semester !== (initialData.semester || '') ||
              code !== (initialData.code || '') ||
              courseContent !== (initialData.course_content || '') ||
              credits !== String(initialData.credits || '') ||
              lecturer !== (initialData.lecturer || '') ||
              day !== (initialData.day || '') ||
              hourStart !== (initialData.hour_start || '') ||
              hourEnd !== (initialData.hour_end || '')
            : semester !== '' ||
              code !== '' ||
              courseContent !== '' ||
              credits !== '' ||
              lecturer !== '' ||
              day !== '' ||
              hourStart !== '' ||
              hourEnd !== '';

    useEffect(() => {
        if (!open) {
            return;
        }

        if (mode === 'edit' && initialData) {
            setSemester(initialData.semester || '');
            setCode(initialData.code || '');
            setCourseContent(initialData.course_content || '');
            setCredits(String(initialData.credits || ''));
            setLecturer(initialData.lecturer || '');
            setDay(initialData.day || '');
            setHourStart(initialData.hour_start || '');
            setHourEnd(initialData.hour_end || '');
            setErrors({});
            return;
        }

        setSemester(selectedSemester || 'Semester 1');
        setCode('');
        setCourseContent('');
        setCredits('');
        setLecturer('');
        setDay('');
        setHourStart('');
        setHourEnd('');
        setErrors({});
    }, [open, mode, initialData, selectedSemester]);

    const handleSubmit = async (event) => {
        event.preventDefault();

        const clientErrors = validateRequired(
            { semester, code, course_content: courseContent, credits, lecturer, day, hour_start: hourStart, hour_end: hourEnd },
            [
                { name: 'semester', label: 'Semester' },
                { name: 'code', label: 'Kode' },
                { name: 'course_content', label: 'Mata Kuliah' },
                { name: 'credits', label: 'SKS' },
                { name: 'lecturer', label: 'Dosen' },
                { name: 'day', label: 'Hari' },
                { name: 'hour_start', label: 'Jam Mulai' },
                { name: 'hour_end', label: 'Jam Selesai' },
            ]
        );
        if (Object.keys(clientErrors).length > 0) {
            setErrors(clientErrors);
            return;
        }

        const payload = {
            semester,
            code,
            course_content: courseContent,
            credits: Number(credits),
            lecturer,
            day,
            hour_start: hourStart,
            hour_end: hourEnd,
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
                    <DialogTitle>{mode === 'create' ? 'Tambah Mata Kuliah Baru' : 'Ubah Mata Kuliah'}</DialogTitle>
                    <DialogDescription>
                        {mode === 'create'
                            ? 'Masukkan detail mata kuliah yang diambil.'
                            : 'Perbarui detail mata kuliah yang dipilih.'}
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <FormField label="Semester" error={getFieldError(errors, 'semester')}>
                        <Select value={semester} onValueChange={setSemester}>
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

                    <FormField label="Kode" error={getFieldError(errors, 'code')}>
                        <Input value={code} onChange={(event) => setCode(event.target.value)} placeholder="Masukkan kode" required />
                    </FormField>

                    <FormField label="Mata Kuliah" error={getFieldError(errors, 'course_content')}>
                        <Input
                            value={courseContent}
                            onChange={(event) => setCourseContent(event.target.value)}
                            placeholder="Masukkan nama mata kuliah"
                            required
                        />
                    </FormField>

                    <FormField label="SKS" error={getFieldError(errors, 'credits')}>
                        <Input
                            type="number"
                            min={1}
                            value={credits}
                            onChange={(event) => setCredits(event.target.value)}
                            placeholder="Masukkan SKS"
                            required
                        />
                    </FormField>

                    <FormField label="Dosen" error={getFieldError(errors, 'lecturer')}>
                        <Input
                            value={lecturer}
                            onChange={(event) => setLecturer(event.target.value)}
                            placeholder="Masukkan nama dosen"
                            required
                        />
                    </FormField>

                    <FormField label="Hari" error={getFieldError(errors, 'day')}>
                        <Select value={day} onValueChange={setDay}>
                            <SelectTrigger>
                                <SelectValue placeholder="Pilih hari" />
                            </SelectTrigger>
                            <SelectContent>
                                {DAYS.map((item) => (
                                    <SelectItem key={item} value={item}>
                                        {item}
                                    </SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </FormField>

                    <FormField label="Jam Mulai" error={getFieldError(errors, 'hour_start')}>
                        <Input type="time" value={hourStart} onChange={(event) => setHourStart(event.target.value)} required />
                    </FormField>

                    <FormField label="Jam Selesai" error={getFieldError(errors, 'hour_end')}>
                        <Input type="time" value={hourEnd} onChange={(event) => setHourEnd(event.target.value)} required />
                    </FormField>

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
