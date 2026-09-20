import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { PasswordInput } from '@/components/shared/PasswordInput';
import { Card, CardContent } from '@/components/ui/card';
import Silk from '@/components/backgrounds/Silk';
import { authApi } from '@/api/authApi';
import { validateRequired } from '@/lib/formUtils';
import useSemesterStore from '@/store/useSemesterStore';

const GLASS_CARD =
    'w-full max-w-md border-white/15 bg-white/10 text-white shadow-2xl shadow-blue-950/40 backdrop-blur-xl';
const GLASS_INPUT =
    'h-12 border-white/20 bg-white/10 pl-10 text-white placeholder:text-white/50 focus-visible:ring-white/60';
const GLASS_PASSWORD =
    'h-12 border-white/20 bg-white/10 pl-10 text-white placeholder:text-white/50 focus-visible:ring-white/60';
const GLASS_CHECKBOX =
    'border-white/40 data-[state=checked]:border-white data-[state=checked]:bg-white data-[state=checked]:text-[#2563eb]';

// Icons are positioned inside the inputs, so no FormField labels are used.
const INPUT_WRAPPER = 'relative';

const MailIcon = () => (
    <svg
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
    >
        <rect width="20" height="16" x="2" y="4" rx="2" />
        <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
);

const LockIcon = () => (
    <svg
        className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-white/50"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
    >
        <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </svg>
);

const LoginArrow = () => (
    <svg
        className="mr-2 h-4 w-4"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
    >
        <path d="M5 12h14" />
        <path d="m12 5 7 7-7 7" />
    </svg>
);

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
        <div className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-[#0A0A1F] p-4">
            <div className="absolute inset-0">
                <Silk
                    speed={3.6}
                    scale={0.4}
                    color="#31405b"
                    noiseIntensity={0.2}
                    rotation={0}
                />
            </div>

            <div className="relative z-10 flex w-full max-w-md flex-col">
                {/* Brand */}
                <div className="mb-8 flex items-center justify-center gap-3">
                    <img
                        src="/logo.webp"
                        className="h-11 w-11 drop-shadow-[0_8px_24px_rgba(82,39,255,0.45)]"
                        alt="logo"
                    />
                    <span className="text-xl font-bold tracking-tight">
                        <span className="text-white">Task</span>{' '}
                        <span className="text-[#7db4ff]">Reminder</span>
                    </span>
                </div>

                {/* Headline — outside the card so it reads as page copy */}
                <h1 className="text-center text-3xl font-bold text-white">Selamat datang kembali!</h1>
                <p className="mb-6 mt-2 text-center text-sm text-white/70">
                    Masuk untuk melanjutkan ke akun kamu.
                </p>

                <Card className={GLASS_CARD}>
                    <CardContent className="pt-6">
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className={INPUT_WRAPPER}>
                                <MailIcon />
                                <Input
                                    type="email"
                                    placeholder="Masukkan email Anda"
                                    value={email}
                                    autoComplete="username"
                                    required
                                    onChange={(event) => setEmail(event.target.value)}
                                    className={GLASS_INPUT}
                                />
                                {message.email ? (
                                    <p className="mt-1 text-sm text-red-300">{message.email}</p>
                                ) : null}
                            </div>

                            <div className={`${INPUT_WRAPPER} [&_button]:text-white/60 hover:[&_button]:text-white`}>
                                <LockIcon />
                                <PasswordInput
                                    placeholder="Masukkan kata sandi Anda"
                                    value={password}
                                    onChange={setPassword}
                                    autoComplete="current-password"
                                    required
                                    className={GLASS_PASSWORD}
                                />
                                {message.password ? (
                                    <p className="mt-1 text-sm text-red-300">{message.password}</p>
                                ) : null}
                            </div>

                            <div className="flex items-center justify-between">
                                <label className="flex cursor-pointer items-center gap-2">
                                    <Checkbox
                                        checked={rememberMe}
                                        onCheckedChange={(checked) => setRememberMe(checked === true)}
                                        className={GLASS_CHECKBOX}
                                    />
                                    <span className="text-sm text-white/80">Ingat saya</span>
                                </label>
                                <Link
                                    to="/auth/forgot-password"
                                    className="text-sm text-[#7db4ff] transition-colors hover:text-white hover:underline"
                                >
                                    Lupa kata sandi?
                                </Link>
                            </div>

                            <Button
                                type="submit"
                                className="h-12 w-full bg-[#2f6fed] text-white shadow-lg shadow-blue-900/40 hover:bg-[#2a63d4]"
                            >
                                <LoginArrow />
                                {loading ? 'Memproses...' : 'Masuk'}
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                {/* Footer — outside the card */}
                <p className="mt-6 text-center text-sm text-white/70">
                    Belum punya akun?{' '}
                    <Link to="/auth/register" className="font-medium text-[#7db4ff] hover:text-white hover:underline">
                        Daftar di sini
                    </Link>
                </p>
            </div>
        </div>
    );
};

export default Login;
