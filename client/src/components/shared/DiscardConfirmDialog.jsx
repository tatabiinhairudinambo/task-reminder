import { memo } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';

export const DiscardConfirmDialog = memo(({ open, onOpenChange, onConfirm }) => {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Buang perubahan?</DialogTitle>
                    <DialogDescription>Anda memiliki perubahan yang belum disimpan. Buang perubahan tersebut?</DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button variant="outline" onClick={() => onOpenChange(false)}>
                        Lanjut Mengedit
                    </Button>
                    <Button variant="destructive" onClick={onConfirm}>
                        Buang
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
});

DiscardConfirmDialog.displayName = 'DiscardConfirmDialog';
