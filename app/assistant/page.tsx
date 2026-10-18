import { getCurrentUser } from "@/lib/auth/session";
import { getSidebarCounts } from "@/lib/services/shiftStatistics";
import { Sidebar } from "@/components/layout/Sidebar";
import { AssistantChat } from "@/components/assistant/AssistantChat";

export default async function AssistantPage() {
  const currentUser = await getCurrentUser();
  const sidebarCounts = await getSidebarCounts();

  return (
    <div style={{ height: "100vh", background: "var(--parchment)", overflow: "hidden", display: "flex" }}>
      <Sidebar currentUser={currentUser} activeConflictsCount={sidebarCounts.activeConflictsCount} />
      <div
        className="app-shell"
        style={{
          flex: 1,
          height: "100vh",
          display: "flex",
          flexDirection: "column",
          padding: "16px 24px",
          boxSizing: "border-box",
          overflow: "hidden",
        }}
      >
        <main style={{ flex: 1, minHeight: 0, display: "flex", flexDirection: "column" }}>
          <AssistantChat currentUser={currentUser} />
        </main>
      </div>
    </div>
  );
}
