import { getCurrentUser } from "@/lib/auth/session";
import { getSidebarCounts } from "@/lib/services/shiftStatistics";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { AssistantChat } from "@/components/assistant/AssistantChat";

export default async function AssistantPage() {
  const currentUser = await getCurrentUser();
  const sidebarCounts = await getSidebarCounts();

  return (
    <div style={{ minHeight: "100vh", background: "var(--parchment)" }}>
      <Sidebar currentUser={currentUser} activeConflictsCount={sidebarCounts.activeConflictsCount} />
      <div className="app-shell" style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}>
        <Header currentUser={currentUser} />
        <main className="zpage-main">
          <AssistantChat currentUser={currentUser} />
        </main>
      </div>
    </div>
  );
}
