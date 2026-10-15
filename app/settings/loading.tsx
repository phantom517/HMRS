// app/settings/loading.tsx — parchment-toned loading state.
export default function SettingsLoading() {
  return (
    <main
      className="zpage-main"
      style={{ maxWidth: 1200, width: "100%", margin: "0 auto", padding: "36px 36px 96px", flex: 1 }}
      aria-busy="true"
    >
      <div className="h-8 w-40 rounded-[10px] bg-(--linen)" />
      <div className="mt-8 flex gap-1">
        {[0, 1, 2].map((i) => (
          <div key={i} className="h-10 w-28 rounded-[10px] bg-(--linen)" />
        ))}
      </div>
      <div className="mt-6 rounded-xl border border-(--ink-border) bg-(--paper) p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-5 w-56 rounded bg-(--linen)" />
          <div className="h-5 w-full rounded bg-(--linen)" />
          <div className="h-5 w-3/4 rounded bg-(--linen)" />
        </div>
      </div>
    </main>
  );
}
