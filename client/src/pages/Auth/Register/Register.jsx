import { useEffect, useState } from 'react';
import { Info } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from '@/components/ui/tooltip';
import { FormField } from '@/components/shared/FormField';
import { PasswordInput } from '@/components/shared/PasswordInput';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { authApi } from '@/api/authApi';
import { validateRequired } from '@/lib/formUtils';

const Register = () => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState({});

    const navigate = useNavigate();

    const handleSubmit = async (event) => {
        event.preventDefault();

        const clientErrors = validateRequired(
            { name, email, password, password_confirmation: confirmPassword },
            [
                { name: 'name', label: 'Nama' },
                { name: 'email', label: 'Email' },
                { name: 'password', label: 'Kata Sandi' },
                { name: 'password_confirmation', label: 'Konfirmasi Kata Sandi' },
            ]
        );
        if (Object.keys(clientErrors).length > 0) {
            setMessage(clientErrors);
            return;
        }

        const formData = new FormData();
        formData.append('name', name);
        formData.append('email', email);
        formData.append('password', password);
        formData.append('password_confirmation', confirmPassword);

        try {
            setLoading(true);
            const response = await authApi.register(formData);

            localStorage.setItem('token', response.data.data.token);
            localStorage.setItem('email', response.data.data.user.email);
            localStorage.setItem('name', response.data.data.user.name);
            localStorage.setItem('isEmailVerified', false);

            navigate('/auth/verify-email');
        } catch (error) {
            const errors = error.response?.data?.errors || {};
            setMessage(errors);
            toast.error(error.response?.data?.message || 'Pendaftaran gagal');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        localStorage.removeItem('isPasswordReset');
        document.title = 'Daftar - Task Reminder';
    }, []);

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
            <img src="/logo.webp" className="mb-8 mt-4 w-32" alt="logo" />
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle className="text-2xl">Ayo Daftar</CardTitle>
                    <CardDescription>Masukkan data untuk membuat akun Anda.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className='space-y-4'>
                        <FormField label='Nama' error={message.name}>
                            <Input
                                placeholder='John Doe'
                                value={name}
                                onChange={(event) => setName(event.target.value)}
                                autoComplete='name'
                                required
                            />
                        </FormField>

                        <FormField
                            label={
                                <span className='flex items-center gap-2'>
                                    Email
                                    <TooltipProvider>
                                        <Tooltip>
                                            <TooltipTrigger asChild>
                                                <Info className='h-3 w-3' />
                                            </TooltipTrigger>
                                            <TooltipContent>Email digunakan untuk mengirim notifikasi.</TooltipContent>
                                        </Tooltip>
                                    </TooltipProvider>
                                </span>
                            }
                            error={message.email}
                        >
                            <Input
                                type='email'
                                placeholder='john.doe@gmail.com'
                                value={email}
                                onChange={(event) => setEmail(event.target.value)}
                                autoComplete='email'
                                required
                            />
                        </FormField>

                        <FormField label='Kata Sandi' error={message.password}>
                            <PasswordInput
                                placeholder='**********'
                                value={password}
                                onChange={setPassword}
                                autoComplete='new-password'
                                required
                            />
                        </FormField>

                        <FormField label='Konfirmasi Kata Sandi' error={message.password_confirmation}>
                            <PasswordInput
                                placeholder='**********'
                                value={confirmPassword}
                                onChange={setConfirmPassword}
                                autoComplete='new-password'
                                required
                            />
                        </FormField>

                        <Button type='submit' className='w-full'>
                            {loading ? 'Mendaftar...' : 'Daftar'}
                        </Button>
                    </form>

                    <p className='mt-6 text-center text-sm'>
                        Sudah punya akun?{' '}
                        <Link to='/auth/login' className='text-primary hover:text-primary/80'>
                            Masuk
                        </Link>
                    </p>
                </CardContent>
            </Card>
        </div>
    );
};

export default Register;
