"use client";

interface OrbLoaderProps {
  progress: number; // 0 to 100
  statusText: string;
}

export default function OrbLoader({ progress, statusText }: OrbLoaderProps) {
  const normalizedProgress = Math.min(100, Math.max(0, progress));

  return (
    <div className="my-8 flex flex-col items-center justify-center space-y-8">
      <div className="orb-loader relative flex h-72 w-72 items-center justify-center" aria-label={`Analysis progress: ${Math.round(normalizedProgress)}%`}>
        <div className="orb-loader__halo absolute inset-8 rounded-full" />
        <div className="orb-loader__ring orb-loader__ring--outer absolute inset-0 rounded-full border border-emerald-300/30" />
        <div className="orb-loader__ring orb-loader__ring--middle absolute inset-5 rounded-full border border-emerald-400/40" />
        <div className="orb-loader__ring orb-loader__ring--inner absolute inset-10 rounded-full border border-dashed border-emerald-300/50" />
        <div className="orb-loader__energy orb-loader__energy--one absolute h-3 w-3 rounded-full bg-cyan-200 shadow-[0_0_18px_6px_rgba(103,232,249,0.7)]" />
        <div className="orb-loader__energy orb-loader__energy--two absolute h-2 w-2 rounded-full bg-emerald-200 shadow-[0_0_15px_5px_rgba(110,231,183,0.8)]" />

        <div className="relative flex h-48 w-48 items-center justify-center overflow-hidden rounded-full border-2 border-emerald-300/70 bg-slate-950 shadow-[0_0_50px_rgba(16,185,129,0.35)]">
          <div
            className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-emerald-700 via-emerald-400 to-cyan-200 opacity-85 transition-[height] duration-500 ease-out"
            style={{ height: `${normalizedProgress}%` }}
          />
          <div className="orb-loader__surface absolute inset-0 rounded-full bg-emerald-300/10" />
          <div className="relative z-10 flex flex-col items-center justify-center">
            <span className="text-4xl font-extrabold tracking-tight text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)]">{Math.round(normalizedProgress)}%</span>
            <span className="mt-1 text-xs font-bold uppercase tracking-widest text-emerald-200">Divining</span>
          </div>
        </div>
      </div>

      <p className="max-w-sm text-center text-lg font-semibold text-slate-300">
        {statusText}
      </p>
    </div>
  );
}