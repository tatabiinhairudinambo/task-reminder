import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { PasswordInput } from '@/components/shared/PasswordInput';
import { FormField } from '@/components/shared/FormField';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { passwordApi } from '@/api/passwordApi';
import { validateRequired } from '@/lib/formUtils';

const ResetPassword = () => {
    const [searchParams] = useSearchParams();
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [message, setMessage] = useState({});
    const [loading, setLoading] = useState(false);

    const token = searchParams.get('token');
    const email = searchParams.get('email');

    const navigate = useNavigate();

    const handleSubmit = async (event) => {
        event.preventDefault();

        const clientErrors = validateRequired(
            { password, password_confirmation: confirmPassword },
            [
                { name: 'password', label: 'Kata Sandi' },
                { name: 'password_confirmation', label: 'Konfirmasi Kata Sandi' },
            ]
        );
        if (Object.keys(clientErrors).length > 0) {
            setMessage(clientErrors);
            return;
        }

        const formData = new FormData();
        formData.append('token', token || '');
        formData.append('email', email || '');
        formData.append('password', password);
        formData.append('password_confirmation', confirmPassword);

        try {
            setLoading(true);
            const response = await passwordApi.resetPassword(formData);
            toast.success(response?.data?.message || 'Kata sandi berhasil direset');

            localStorage.removeItem('isPasswordReset');
            navigate('/auth/login');
        } catch (error) {
            const errors = error.response?.data?.errors || {};
            setMessage(errors);
            toast.error(error.response?.data?.message || 'Gagal mereset kata sandi');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!token || !email) {
            navigate('/auth/login');
        }
    }, [token, email, navigate]);

    useEffect(() => {
        document.title = 'Reset Kata Sandi - Task Reminder';
    }, []);

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
            <img src='/logo.webp' className='mb-8 mt-4 w-32' alt='logo' />
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle className='text-2xl'>Buat Kata Sandi Baru</CardTitle>
                    <CardDescription>Masukkan kata sandi baru Anda dan jangan lupa.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className='space-y-4'>
                        <FormField label='Kata Sandi' error={message.password}>
                            <PasswordInput
                                placeholder='Kata Sandi'
                                value={password}
                                onChange={setPassword}
                                autoComplete='new-password'
                                required
                            />
                        </FormField>

                        <FormField label='Konfirmasi Kata Sandi' error={message.password_confirmation}>
                            <PasswordInput
                                placeholder='Konfirmasi Kata Sandi'
                                value={confirmPassword}
                                onChange={setConfirmPassword}
                                autoComplete='new-password'
                                required
                            />
                        </FormField>

                        <Button type='submit' className='w-full'>
                            {loading ? 'Mereset Kata Sandi...' : 'Reset Kata Sandi'}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
};

export default ResetPassword;
