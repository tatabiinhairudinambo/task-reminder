import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FormField } from '@/components/shared/FormField';
import { PasswordInput } from '@/components/shared/PasswordInput';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getFieldError, validateRequired } from '@/lib/formUtils';

export const PasswordForm = ({ onSubmit }) => {
    const [currentPassword, setCurrentPassword] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [errors, setErrors] = useState({});
    const [oldPasswordError, setOldPasswordError] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    const handleSubmit = async (event) => {
        event.preventDefault();
        const clientErrors = validateRequired(
            { old_password: currentPassword, password: newPassword, password_confirmation: confirmPassword },
            [
                { name: 'old_password', label: 'Kata Sandi Saat Ini' },
                { name: 'password', label: 'Kata Sandi Baru' },
                { name: 'password_confirmation', label: 'Konfirmasi Kata Sandi' },
            ]
        );
        if (Object.keys(clientErrors).length > 0) {
            setErrors({ password: clientErrors.password, password_confirmation: clientErrors.password_confirmation });
            setOldPasswordError(clientErrors.old_password || '');
            return;
        }
        setIsSubmitting(true);
        try {
            const result = await onSubmit({
                old_password: currentPassword,
                password: newPassword,
                password_confirmation: confirmPassword,
            });

            if (result.success) {
                setCurrentPassword('');
                setNewPassword('');
                setConfirmPassword('');
                setErrors({});
                setOldPasswordError('');
                return;
            }

            setErrors(result.errors || {});
            setOldPasswordError(result.oldPasswordError || '');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle>Perbarui Kata Sandi</CardTitle>
                <CardDescription>Pastikan akun Anda menggunakan kata sandi yang panjang dan aman.</CardDescription>
            </CardHeader>
            <CardContent>
                <form className="space-y-4" onSubmit={handleSubmit}>
                    <FormField label="Kata Sandi Saat Ini" error={oldPasswordError}>
                        <PasswordInput
                            value={currentPassword}
                            onChange={setCurrentPassword}
                            placeholder="Masukkan kata sandi saat ini"
                            required
                        />
                    </FormField>

                    <FormField label="Kata Sandi Baru" error={getFieldError(errors, 'password')}>
                        <PasswordInput
                            value={newPassword}
                            onChange={setNewPassword}
                            placeholder="Masukkan kata sandi baru"
                            required
                        />
                    </FormField>

                    <FormField label="Konfirmasi Kata Sandi" error={getFieldError(errors, 'password_confirmation')}>
                        <PasswordInput
                            value={confirmPassword}
                            onChange={setConfirmPassword}
                            placeholder="Konfirmasi kata sandi baru Anda"
                            required
                        />
                    </FormField>

                    <Button type="submit" disabled={isSubmitting}>
                        {isSubmitting ? 'Menyimpan...' : 'Simpan'}
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
};
