import { CalendarDays, Bell, GraduationCap } from 'lucide-react';

// Copy is derived from ALUR-SISTEM.md so the pitch matches what the app
// actually does.
const FEATURES = [
    {
        icon: CalendarDays,
        title: 'Jadwal terpusat',
        description: 'Jadwal kuliah mingguan tersusun otomatis dari mata kuliah yang kamu isi.',
    },
    {
        icon: Bell,
        title: 'Pengingat tepat waktu',
        description: 'Reminder Email atau Telegram sebelum tenggat, plus penanda tugas prioritas.',
    },
    {
        icon: GraduationCap,
        title: 'Nilai & IPK',
        description: 'Isi skor sekali, IPK semester dan kumulatif dihitung otomatis.',
    },
];

export const AuthHero = () => {
    return (
        <div className="hidden flex-1 flex-col justify-center px-10 lg:flex xl:px-16 2xl:px-24">
            {/* Greeting — a warm salutation that reads as a subtitle above the
                headline, so it is sized up rather than treated as a label. */}
            <p className="mb-3 text-2xl font-semibold text-[#7db4ff] xl:text-3xl">
                Halo sobat task
            </p>

            {/* Headline */}
            <h2 className="max-w-xl text-4xl font-bold leading-tight text-white xl:text-5xl">
                Kelola tugas kuliah,
                <br />
                <span className="text-[#7db4ff]">capai tujuanmu!</span>
            </h2>

            <p className="mt-5 max-w-lg text-base leading-relaxed text-white/70">
                Task Reminder membantumu mencatat tugas, mengingatkan sebelum tenggat, dan memantau
                nilai serta IPK — semuanya dalam satu tempat.
            </p>

            {/* Feature grid */}
            <div className="mt-12 grid max-w-2xl gap-6 sm:grid-cols-3">
                {FEATURES.map(({ icon: Icon, title, description }) => (
                    <div key={title}>
                        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-white/15 bg-white/5">
                            <Icon className="h-5 w-5 text-[#9cc4ff]" />
                        </div>
                        <p className="text-sm font-semibold text-white">{title}</p>
                        <p className="mt-1.5 text-xs leading-relaxed text-white/60">{description}</p>
                    </div>
                ))}
            </div>
        </div>
    );
};

export default AuthHero;
