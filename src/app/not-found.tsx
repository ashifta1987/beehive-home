import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-3 p-6 text-center">
      <p className="font-display text-[22px] font-extrabold">Page not found</p>
      <p className="text-muted">This page does not exist or was moved.</p>
      <Link href="/" className="mt-2 inline-flex min-h-11 items-center rounded-[14px] bg-ink px-4 font-semibold text-surface">Go to the start</Link>
    </main>
  );
}
