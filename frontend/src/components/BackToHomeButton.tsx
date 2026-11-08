"use client";

import { useRouter } from "next/navigation";

export default function BackToHomeButton() {
  const router = useRouter();

  return (
    <button
      type="button"
      onClick={() => router.back()}
      className="text-sm text-slate-400 transition-colors hover:text-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
    >
      Back to home
    </button>
  );
}
