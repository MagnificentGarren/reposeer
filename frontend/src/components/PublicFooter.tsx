import Link from "next/link";

type PublicFooterProps = {
  hidePrivacyLink?: boolean;
};

export default function PublicFooter({ hidePrivacyLink = false }: PublicFooterProps) {
  return (
    <footer className="border-t border-emerald-950/40 px-8 py-8">
      <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 text-center text-xs text-slate-600 sm:flex-row sm:text-left">
        <span>Reposeer Architecture Intelligence Studio</span>
        {!hidePrivacyLink && (
          <Link
            href="/privacy"
            className="text-slate-400 transition-colors hover:text-emerald-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400"
          >
            Privacy Policy
          </Link>
        )}
      </div>
    </footer>
  );
}
