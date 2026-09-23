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

// This column only renders at `lg` and up. Everything behind it — the WebGL
// backdrop and the photo — is dark, so the copy is authored light-on-dark.
export const AuthHero = () => {
    return (
        <div className="hidden min-h-0 flex-1 flex-col lg:flex">
            {/*
              Students photo. The source is a transparent cut-out, so there is
              no rectangle to hide. The panel takes whatever height is left
              above the copy, and the photo is pinned to the bottom of it, so
              the bottom edge of the photo (its waist-level cut) always lands
              exactly above the description paragraph — the photo is shifted
              down, not scaled, which is why the panel can grow without
              re-cropping the students horizontally.
              The letterbox left by `contain` on very wide/short viewports is
              invisible: the backdrop behind it is the same dark sky.
            */}
            <div className="relative min-h-0 flex-1 select-none overflow-hidden">
                <div
                    aria-hidden="true"
                    className="absolute inset-0"
                    style={{
                        // First mask, on the container, so the ramp is measured
                        // against the visible panel and reliably reaches zero
                        // exactly at its bottom edge — no leftover hairline
                        // where the torsos are cut off. It stays on this inner
                        // layer so the headline and greeting over the photo are
                        // not faded with it.
                        maskImage:
                            'linear-gradient(to bottom, #000 0%, #000 46%, rgba(0,0,0,0.86) 60%, rgba(0,0,0,0.55) 74%, rgba(0,0,0,0.22) 88%, transparent 100%)',
                        WebkitMaskImage:
                            'linear-gradient(to bottom, #000 0%, #000 46%, rgba(0,0,0,0.86) 60%, rgba(0,0,0,0.55) 74%, rgba(0,0,0,0.22) 88%, transparent 100%)',
                    }}
                >
                    <img
                        src="/hero-students.webp"
                        alt=""
                        className="absolute inset-0 h-full w-full object-contain object-bottom"
                        style={{
                            filter: 'brightness(1.02) saturate(1.02)',
                            // Second mask, on the photo itself: the cut-out runs
                            // to the very edges of the frame, so both side seams
                            // are dissolved rather than cut — the right one where
                            // the girl's arm meets the sign-in column, the left
                            // one at the page edge. Nesting the two masks
                            // multiplies their alphas, so no `mask-composite`
                            // support is needed.
                            maskImage:
                                'linear-gradient(to right, transparent 0%, rgba(0,0,0,0.6) 3%, #000 9%, #000 84%, rgba(0,0,0,0.5) 93%, transparent 100%)',
                            WebkitMaskImage:
                                'linear-gradient(to right, transparent 0%, rgba(0,0,0,0.6) 3%, #000 9%, #000 84%, rgba(0,0,0,0.5) 93%, transparent 100%)',
                        }}
                    />
                </div>

                {/* Greeting + headline sit at the very bottom of the photo, so
                    the paragraph below starts right where the photo ends. */}
                <div className="absolute inset-x-0 bottom-0 px-10 xl:px-16 2xl:px-24">
                    {/* Greeting — a warm salutation that reads as a subtitle
                        above the headline, so it is sized up rather than
                        treated as a label. */}
                    <p className="mb-3 text-2xl font-semibold text-[#7db4ff] [text-shadow:0_2px_12px_rgba(5,7,13,0.75)] xl:text-3xl [@media(max-height:860px)]:mb-2 [@media(max-height:860px)]:text-xl">
                        Halo sobat task😊
                    </p>

                    {/* Headline */}
                    <h2 className="max-w-xl text-4xl font-bold leading-tight text-white [text-shadow:0_2px_14px_rgba(5,7,13,0.8)] xl:text-5xl [@media(max-height:860px)]:text-3xl">
                        Kelola tugas kuliah,
                        <br />
                        <span className="text-[#7db4ff]">capai tujuanmu!</span>
                    </h2>
                </div>
            </div>

            {/* Copy sits below the photo. It shrinks on short viewports so the
                photo keeps room. Authored light-on-dark: the WebGL backdrop
                behind this column is always dark. */}
            <div className="shrink-0 px-10 pb-16 [@media(max-height:860px)]:pb-10 xl:px-16 2xl:px-24">
                <p className="mt-5 max-w-lg text-base leading-relaxed text-white/70 [@media(max-height:860px)]:mt-3 [@media(max-height:860px)]:text-sm">
                    Task Reminder membantumu mencatat tugas, mengingatkan sebelum tenggat, dan
                    memantau nilai serta IPK semuanya dalam satu tempat.
                </p>

                {/* Feature grid */}
                <div className="mt-8 grid max-w-2xl gap-6 sm:grid-cols-3 [@media(max-height:860px)]:mt-6">
                    {FEATURES.map(({ icon: Icon, title, description }) => (
                        <div key={title}>
                            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl border border-white/15 bg-white/5 [@media(max-height:860px)]:mb-2 [@media(max-height:860px)]:h-10 [@media(max-height:860px)]:w-10">
                                <Icon className="h-5 w-5 text-[#9cc4ff]" />
                            </div>
                            <p className="text-sm font-semibold text-white">{title}</p>
                            <p className="mt-1.5 text-xs leading-relaxed text-white/60">
                                {description}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

export default AuthHero;
