import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { FormField } from '@/components/shared/FormField';
import { PasswordInput } from '@/components/shared/PasswordInput';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { authApi } from '@/api/authApi';
import { validateRequired } from '@/lib/formUtils';
import useSemesterStore from '@/store/useSemesterStore';

const Login = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [rememberMe, setRememberMe] = useState(false);
    const [message, setMessage] = useState({});
    const [loading, setLoading] = useState(false);

    const navigate = useNavigate();

    const handleSubmit = async (event) => {
        event.preventDefault();

        const clientErrors = validateRequired({ email, password }, [
            { name: 'email', label: 'Email' },
            { name: 'password', label: 'Kata Sandi' },
        ]);
        if (Object.keys(clientErrors).length > 0) {
            setMessage(clientErrors);
            return;
        }

        const loginData = {
            email,
            password,
            remember_me: rememberMe,
        };

        try {
            setLoading(true);
            setMessage({});

            const response = await authApi.login(loginData);
            toast.success(response?.data?.message);

            localStorage.setItem('token', response.data.data.token);
            localStorage.setItem('email', response.data.data.user.email);
            localStorage.setItem('name', response.data.data.user.name);
            useSemesterStore.getState().setUserName(response.data.data.user.name);

            const emailCheck = await authApi.checkEmail();
            const verified = emailCheck.data?.data?.verified === true;
            localStorage.setItem('isEmailVerified', verified);

            if (verified) {
                navigate('/dashboard');
            } else {
                navigate('/auth/verify-email');
            }
        } catch (error) {
            const errors = error.response?.data?.errors || {};
            setMessage(errors);
            toast.error(error.response?.data?.message || 'Gagal masuk');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        const storedToken = localStorage.getItem('token');
        const isEmailVerified = localStorage.getItem('isEmailVerified');

        if (storedToken && isEmailVerified === 'true') {
            navigate('/dashboard');
        }
    }, [navigate]);

    useEffect(() => {
        document.title = 'Masuk - Task Reminder';
    }, []);

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-background p-4">
            <img src="/logo.webp" className="mb-8 mt-4 w-32" alt="logo" />
            <Card className="w-full max-w-md">
                <CardHeader>
                    <CardTitle className="text-2xl">Mulai Sekarang</CardTitle>
                    <CardDescription>Masukkan kredensial Anda untuk mengakses akun.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-4">
                        <FormField label='Email' error={message.email}>
                            <Input
                                placeholder='Masukkan email Anda'
                                value={email}
                                autoComplete='username'
                                required
                                onChange={(event) => setEmail(event.target.value)}
                            />
                        </FormField>

                        <FormField label='Kata Sandi' error={message.password}>
                            <PasswordInput
                                placeholder='Masukkan kata sandi Anda'
                                value={password}
                                onChange={setPassword}
                                autoComplete='current-password'
                                required
                            />
                        </FormField>

                        <div className='flex justify-between items-center'>
                            <div className='flex items-center gap-2'>
                                <label className="flex items-center gap-2 cursor-pointer">
                                    <Checkbox
                                        checked={rememberMe}
                                        onCheckedChange={(checked) => setRememberMe(checked === true)}
                                    />
                                    <span className="text-sm">Ingat saya</span>
                                </label>
                            </div>
                            <Link to='/auth/forgot-password' className='mr-2 text-sm text-primary hover:text-primary/80'>
                                Lupa kata sandi?
                            </Link>
                        </div>

                        <Button type='submit' className='w-full'>
                            {loading ? 'Memproses...' : 'Masuk'}
                        </Button>
                    </form>

                    <p className='mt-6 text-sm'>
                        Belum punya akun?{' '}
                        <Link to='/auth/register' className='text-primary hover:text-primary/80'>
                            Daftar
                        </Link>
                    </p>
                </CardContent>
            </Card>
        </div>
    );
};

export default Login;
