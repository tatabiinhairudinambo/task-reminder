import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { FormField } from '@/components/shared/FormField';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { getFieldError, validateRequired } from '@/lib/formUtils';

export const ProfileForm = ({ userData, isLoading, onSubmit }) => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [errors, setErrors] = useState({});
    const [isSubmitting, setIsSubmitting] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        setName(userData?.name || '');
        setEmail(userData?.email || '');
    }, [userData]);

    const handleSubmit = async (event) => {
        event.preventDefault();
        const clientErrors = validateRequired(
            { name, email },
            [
                { name: 'name', label: 'Nama' },
                { name: 'email', label: 'Email' },
            ]
        );
        if (Object.keys(clientErrors).length > 0) {
            setErrors(clientErrors);
            return;
        }
        setIsSubmitting(true);
        try {
            const result = await onSubmit({ name, email });
            if (result.success) {
                setErrors({});
                if (result.emailChanged) {
                    navigate('/auth/verify-email');
                }
                return;
            }
            setErrors(result.errors || {});
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <Card className="w-full">
            <CardHeader>
                <CardTitle>Informasi Profil</CardTitle>
                <CardDescription>Perbarui informasi profil dan alamat email akun Anda.</CardDescription>
            </CardHeader>
            <CardContent>
                <form className="space-y-4" onSubmit={handleSubmit}>
                    <FormField label="Nama" error={getFieldError(errors, 'name')}>
                        {isLoading ? (
                            <Skeleton className="h-10 w-full" />
                        ) : (
                            <Input value={name} onChange={(event) => setName(event.target.value)} placeholder="Masukkan nama Anda" required />
                        )}
                    </FormField>

                    <FormField label="Email" error={getFieldError(errors, 'email')}>
                        {isLoading ? (
                            <Skeleton className="h-10 w-full" />
                        ) : (
                            <Input value={email} onChange={(event) => setEmail(event.target.value)} placeholder="Masukkan email Anda" required />
                        )}
                    </FormField>

                    <Button type="submit" disabled={isSubmitting || isLoading}>
                        {isSubmitting ? 'Menyimpan...' : 'Simpan'}
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
};
