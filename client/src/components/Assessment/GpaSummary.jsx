import { memo } from 'react';
import { Badge } from '@/components/ui/badge';

export const GpaSummary = memo(({ semesterGpa, cumulativeGpa }) => {
    return (
        <div className="flex flex-wrap justify-center gap-3">
            <Badge className="bg-primary px-4 py-2 text-sm text-primary-foreground">IPK Semester: {Number(semesterGpa).toFixed(2)}</Badge>
            <Badge className="bg-success px-4 py-2 text-sm text-success-foreground">IPK Kumulatif: {Number(cumulativeGpa).toFixed(2)}</Badge>
        </div>
    );
});

GpaSummary.displayName = 'GpaSummary';
