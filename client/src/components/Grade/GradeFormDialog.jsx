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
import { FormField } from '@/components/shared/FormField';
import { getFieldError, validateRequired } from '@/lib/formUtils';
import { DiscardConfirmDialog } from '@/components/shared/DiscardConfirmDialog';

export const GradeFormDialog = ({
    open,
    onOpenChange,
    mode,
    initialData,
    isLoading,
    onSubmit,
}) => {
    const [grade, setGrade] = useState('');
    const [gradePoints, setGradePoints] = useState('');
    const [minimalScore, setMinimalScore] = useState('');
    const [maximalScore, setMaximalScore] = useState('');
    const [errors, setErrors] = useState({});
    const [showDiscard, setShowDiscard] = useState(false);

    const isDirty =
        mode === 'edit' && initialData
            ? grade !== (initialData.grade || '') ||
              gradePoints !== String(initialData.grade_point || '') ||
              minimalScore !== String(initialData.minimal_score || '') ||
              maximalScore !== String(initialData.maximal_score || '')
            : grade !== '' || gradePoints !== '' || minimalScore !== '' || maximalScore !== '';

    useEffect(() => {
        if (!open) {
            return;
        }

        if (mode === 'edit' && initialData) {
            setGrade(initialData.grade || '');
            setGradePoints(String(initialData.grade_point || ''));
            setMinimalScore(String(initialData.minimal_score || ''));
            setMaximalScore(String(initialData.maximal_score || ''));
            setErrors({});
            return;
        }

        setGrade('');
        setGradePoints('');
        setMinimalScore('');
        setMaximalScore('');
        setErrors({});
    }, [open, mode, initialData]);

    const handleSubmit = async (event) => {
        event.preventDefault();

        const clientErrors = validateRequired(
            { grade, grade_point: gradePoints, minimal_score: minimalScore, maximal_score: maximalScore },
            [
                { name: 'grade', label: 'Nilai' },
                { name: 'grade_point', label: 'Poin Nilai' },
                { name: 'minimal_score', label: 'Skor Minimal' },
                { name: 'maximal_score', label: 'Skor Maksimal' },
            ]
        );
        if (Object.keys(clientErrors).length > 0) {
            setErrors(clientErrors);
            return;
        }

        const payload = {
            grade,
            grade_point: Number(gradePoints),
            minimal_score: Number(minimalScore),
            maximal_score: Number(maximalScore),
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
            <DialogContent persistent>
                <DialogHeader>
                    <DialogTitle>{mode === 'create' ? 'Tambah Nilai Baru' : 'Ubah Nilai'}</DialogTitle>
                    <DialogDescription>Masukkan detail nilai.</DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    <FormField label="Nilai" error={getFieldError(errors, 'grade')}>
                        <Input value={grade} onChange={(event) => setGrade(event.target.value)} placeholder="Masukkan nilai" required />
                    </FormField>

                    <FormField label="Poin Nilai" error={getFieldError(errors, 'grade_point')}>
                        <Input
                            type="number"
                            min={0}
                            value={gradePoints}
                            onChange={(event) => setGradePoints(event.target.value)}
                            placeholder="Masukkan poin nilai"
                            required
                        />
                    </FormField>

                    <FormField label="Skor Minimal" error={getFieldError(errors, 'minimal_score')}>
                        <Input
                            type="number"
                            min={0}
                            value={minimalScore}
                            onChange={(event) => setMinimalScore(event.target.value)}
                            placeholder="Masukkan skor minimal"
                            required
                        />
                    </FormField>

                    <FormField label="Skor Maksimal" error={getFieldError(errors, 'maximal_score')}>
                        <Input
                            type="number"
                            min={0}
                            value={maximalScore}
                            onChange={(event) => setMaximalScore(event.target.value)}
                            placeholder="Masukkan skor maksimal"
                            required
                        />
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
