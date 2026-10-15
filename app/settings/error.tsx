"use client";

// app/settings/error.tsx — plain-language error with Retry.
export default function SettingsError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main
      className="zpage-main"
      style={{ maxWidth: 1200, width: "100%", margin: "0 auto", padding: "36px 36px 96px", flex: 1 }}
    >
      <div
        role="alert"
        className="rounded-xl border border-(--ink-border) bg-(--critical-bg) px-5 py-4 text-[14px] text-(--critical-text)"
      >
        Settings couldn&apos;t load. {error.message}
      </div>
      <button
        type="button"
        onClick={reset}
        className="mt-4 h-10 rounded-xl px-4 text-[14px] font-medium text-(--ink)"
        style={{ background: "var(--paper)", border: "1px solid var(--ink-border-strong)" }}
      >
        Retry
      </button>
    </main>
  );
}
