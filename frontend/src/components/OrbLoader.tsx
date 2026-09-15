"use client";

interface OrbLoaderProps {
  progress: number; // 0 to 100
  statusText: string;
}

export default function OrbLoader({ progress, statusText }: OrbLoaderProps) {
  return (
    <div className="flex flex-col items-center justify-center space-y-8 my-8">
      {/* Outer Glowing Container */}
      <div className="relative w-64 h-64 flex items-center justify-center">
        
        {/* Fast Reverse Ring Rotation */}
        <div className="absolute inset-0 rounded-full border-2 border-dashed border-emerald-400/40 shadow-[0_0_30px_rgba(16,185,129,0.25)] animate-[spin_12s_linear_infinite]" />

        {/* Outer Counter-Rotating Ring */}
        <div className="absolute inset-3 rounded-full border border-emerald-500/30 animate-[spin_8s_linear_infinite_reverse]" />

        {/* Crystal Orb Frame */}
        <div className="relative w-48 h-48 rounded-full bg-slate-950 border-2 border-emerald-400/70 shadow-[0_0_50px_rgba(16,185,129,0.35)] overflow-hidden flex items-center justify-center">
          
          {/* Liquid Progress Fill */}
          <div
            className="absolute bottom-0 w-full bg-gradient-to-t from-emerald-600 via-emerald-400 to-emerald-300 opacity-85 transition-all duration-500 ease-out"
            style={{ height: `${Math.min(100, Math.max(0, progress))}%` }}
          />

          {/* Pulse Overlay Accent */}
          <div className="absolute inset-0 bg-emerald-300/10 rounded-full animate-pulse blur-sm" />

          {/* Center Glow & Percentage */}
          <div className="relative z-10 flex flex-col items-center justify-center">
            <span className="text-4xl font-extrabold text-white drop-shadow-[0_2px_10px_rgba(0,0,0,0.9)] tracking-tight">
              {Math.round(progress)}%
            </span>
            <span className="text-xs font-bold uppercase tracking-widest text-emerald-200 mt-1">
              Divining
            </span>
          </div>
        </div>
      </div>

      {/* Dynamic Status Text */}
      <p className="text-slate-300 font-semibold text-lg text-center animate-pulse max-w-sm">
        {statusText}
      </p>
    </div>
  );
}