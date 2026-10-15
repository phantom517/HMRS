"use client";

// components/settings/AssistantsTab.tsx — Assistants tab with the
// permissions drawer and the add-assistant flow (one-time password dialog).
import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Copy } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { RowActions, TextButton } from "@/components/settings/RowActions";
import {
  createAssistantAccountAction,
  updateAssistantPermissionsAction,
  toggleAssistantActiveAction,
} from "@/lib/actions/auth";

const thClass = "h-11 px-5 text-[13px] font-medium text-(--ink-secondary)";
const inputStyle =
  "h-10 rounded-[10px] border border-(--ink-border-strong) bg-(--linen) text-[14px] text-(--ink) px-3";

// Permission catalog: every granted permission string lives here, in one
// place, with a one-line description.
const PERMISSION_GROUPS: Array<{
  group: string;
  items: Array<[string, string, string]>;
}> = [
  {
    group: "Employees",
    items: [
      ["canEditEmployees", "Edit employees", "Create and update staff records"],
      ["canDeleteEmployees", "Permanently delete employees", "Irreversible removal with history"],
    ],
  },
  {
    group: "Shifts and roster",
    items: [
      ["canManageShifts", "Manage shift types", "Create, edit and deactivate templates"],
      ["canAssignShifts", "Assign shifts", "Roster changes and reassignments"],
    ],
  },
  {
    group: "Leave",
    items: [["canApproveLeave", "Approve leave", "Approve and reject applications"]],
  },
  {
    group: "Reports",
    items: [["canExportReports", "Export data", "Download rosters and summaries"]],
  },
  {
    group: "Settings",
    items: [
      ["canManagePolicies", "Manage rules", "Edit scheduling rules"],
      ["canViewAuditLogs", "View audit log", "Inspect change history"],
    ],
  },
];

interface AssistantUser {
  id: string;
  name: string;
  email: string;
  title?: string;
  active?: boolean;
  role?: string;
}

export function AssistantsTab({
  users,
  permissions,
  canManage,
}: {
  users: AssistantUser[];
  permissions: Array<Record<string, unknown>>;
  canManage: boolean;
}) {
  const router = useRouter();
  const [drawer, setDrawer] = useState<AssistantUser | null>(null);
  const [perms, setPerms] = useState<Record<string, boolean>>({});
  const [showAdd, setShowAdd] = useState(false);
  const [newAssistant, setNewAssistant] = useState({ name: "", email: "", title: "" });
  const [issuedPassword, setIssuedPassword] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fail = useCallback(
    (err: unknown) => setError(err instanceof Error ? err.message : String(err)),
    []
  );

  const openDrawer = useCallback(
    (user: AssistantUser) => {
      const existing = permissions.find((p) => p.userId === user.id);
      const next: Record<string, boolean> = {};
      for (const g of PERMISSION_GROUPS) {
        for (const [key] of g.items) next[key] = Boolean((existing as Record<string, unknown>)?.[key]);
      }
      setPerms(next);
      setDrawer(user);
    },
    [permissions]
  );

  async function savePermissions() {
    if (!drawer) return;
    setBusy(true);
    setError(null);
    try {
      await updateAssistantPermissionsAction(drawer.id, perms as never);
      setDrawer(null);
      router.refresh();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  async function addAssistant(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await createAssistantAccountAction({
        name: newAssistant.name.trim(),
        email: newAssistant.email.trim(),
        title: newAssistant.title.trim() || "Assistant Clinical Coordinator",
      });
      setShowAdd(false);
      setNewAssistant({ name: "", email: "", title: "" });
      setIssuedPassword(res.tempPassword);
      setCopied(false);
      router.refresh();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex w-full flex-col gap-4">
      {error && (
        <div role="alert" className="rounded-xl border border-(--ink-border) bg-(--critical-bg) px-4 py-3 text-[14px] text-(--critical-text)">
          {error}
        </div>
      )}
      <div className="flex justify-end">
        {canManage && (
          <Button disabled={busy} onClick={() => setShowAdd(true)} className="rounded-xl text-[15px]">
            Add assistant
          </Button>
        )}
      </div>
      <div className="overflow-hidden rounded-xl border border-(--ink-border) bg-(--paper)">
        {users.length === 0 ? (
          <div className="p-10">
            <Empty>
              <EmptyHeader>
                <EmptyTitle className="text-[15px] font-medium">No assistants yet</EmptyTitle>
                <EmptyDescription className="text-[13px] text-(--ink-secondary)">
                  Add someone to help manage the roster.
                </EmptyDescription>
              </EmptyHeader>
              {canManage && (
                <Button disabled={busy} onClick={() => setShowAdd(true)} className="rounded-xl text-[15px]">
                  Add assistant
                </Button>
              )}
            </Empty>
          </div>
        ) : (
          <Table className="ztable">
            <TableHeader>
              <TableRow className="border-(--ink-border) bg-(--linen)">
                <TableHead className={thClass}>Name</TableHead>
                <TableHead className={thClass}>Email</TableHead>
                <TableHead className={thClass}>Permissions</TableHead>
                <TableHead className={thClass}>Status</TableHead>
                <TableHead className={`${thClass} text-right`}>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => {
                const existing = permissions.find((p) => p.userId === user.id) as
                  | Record<string, unknown>
                  | undefined;
                const granted = existing
                  ? Object.entries(existing).filter(([k, v]) => v === true && k.startsWith("can")).length
                  : 0;
                return (
                  <TableRow
                    key={user.id}
                    className="h-14 cursor-pointer border-(--ink-border-row) hover:bg-(--linen)"
                    onClick={() => openDrawer(user)}
                  >
                    <TableCell className="px-5">
                      <div className="text-[15px] font-medium text-(--ink)">{user.name}</div>
                      <div className="text-[13px] text-(--ink-secondary)">{user.title}</div>
                    </TableCell>
                    <TableCell className="px-5 text-[13px] text-(--ink-secondary)">{user.email}</TableCell>
                    <TableCell className="px-5 text-[13px] text-(--ink)">{granted} of 8</TableCell>
                    <TableCell className="px-5">
                      <Badge
                        variant="outline"
                        className={user.active !== false ? "bg-(--linen) text-(--ink)" : "bg-(--linen) text-(--ink-secondary)"}
                      >
                        {user.active !== false ? "Active" : "Inactive"}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-5 text-right" onClick={(e: React.MouseEvent<HTMLTableCellElement>) => e.stopPropagation()}>
                      {canManage && (
                        <RowActions
                          name={user.name}
                          onEdit={() => openDrawer(user)}
                          canDelete
                          active={user.active !== false}
                          onDeactivate={() => {
                            void toggleAssistantActiveAction(user.id, user.active === false);
                          }}
                        />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </div>

      {/* Permissions drawer */}
      <Sheet open={!!drawer} onOpenChange={(open) => !open && setDrawer(null)}>
        <SheetContent side="right" className="w-[480px] p-6 sm:max-w-[480px]">
          {drawer && (
            <div className="flex h-full flex-col gap-4">
              <SheetHeader className="p-0">
                <SheetTitle>{drawer.name}</SheetTitle>
                <SheetDescription className="text-[13px] text-(--ink-secondary)">
                  {drawer.email} — {drawer.title}
                </SheetDescription>
              </SheetHeader>
              <div className="flex-1 overflow-y-auto pr-2">
                {PERMISSION_GROUPS.map((g) => (
                  <div key={g.group} className="mb-4">
                    <div className="mb-2 text-[13px] font-medium text-(--ink-secondary)">{g.group}</div>
                    <div className="flex flex-col gap-2">
                      {g.items.map(([key, label, desc]) => (
                        <label
                          key={key}
                          className="flex items-center justify-between gap-3 rounded-[10px] bg-(--linen) px-3 py-2"
                        >
                          <span>
                            <span className="block text-[14px] font-medium text-(--ink)">{label}</span>
                            <span className="block text-[12px] text-(--ink-secondary)">{desc}</span>
                          </span>
                          <input
                            type="checkbox"
                            checked={Boolean(perms[key])}
                            onChange={(e) => setPerms({ ...perms, [key]: e.target.checked })}
                            className="size-4 accent-(--ink)"
                          />
                        </label>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between gap-3 border-t border-(--ink-border) pt-4">
                <Button
                  variant="secondary"
                  className="rounded-xl"
                  disabled={busy}
                  onClick={() => {
                    void toggleAssistantActiveAction(drawer.id, drawer.active === false);
                  }}
                >
                  {drawer.active !== false ? "Deactivate assistant" : "Reactivate assistant"}
                </Button>
                <Button disabled={busy} onClick={savePermissions} className="rounded-xl text-[15px]">
                  Save permissions
                </Button>
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Add assistant dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-md rounded-xl border border-(--ink-border) bg-(--paper) p-6">
          <DialogHeader>
            <DialogTitle>Add assistant</DialogTitle>
            <DialogDescription className="text-[13px] text-(--ink-secondary)">
              A temporary password is generated and shown once.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={addAssistant} className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <Label htmlFor="ast-name" className="text-[13px] font-medium text-(--ink)">Name</Label>
              <Input
                id="ast-name"
                value={newAssistant.name}
                onChange={(e) => setNewAssistant({ ...newAssistant, name: e.target.value })}
                className={inputStyle}
                required
              />
            </div>
            <div className="flex flex-col gap-1">
              <Label htmlFor="ast-email" className="text-[13px] font-medium text-(--ink)">Email</Label>
              <Input
                id="ast-email"
                type="email"
                value={newAssistant.email}
                onChange={(e) => setNewAssistant({ ...newAssistant, email: e.target.value })}
                className={inputStyle}
                required
              />
            </div>
            <div className="flex items-center justify-end gap-3 pt-2">
              <Button type="button" variant="secondary" className="rounded-xl" onClick={() => setShowAdd(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={busy} className="rounded-xl text-[15px]">
                Create account
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* One-time temp password dialog */}
      <Dialog
        open={!!issuedPassword}
        onOpenChange={(open) => {
          if (!open) setIssuedPassword(null);
        }}
      >
        <DialogContent className="max-w-md rounded-xl border border-(--ink-border) bg-(--paper) p-6">
          <DialogHeader>
            <DialogTitle>Temporary password</DialogTitle>
            <DialogDescription className="text-[13px] text-(--ink-secondary)">
              Shown once — copy it now and share it securely. The assistant must change it at first sign-in.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 rounded-[10px] bg-(--linen) px-3 py-3">
            <code className="flex-1 select-all text-[14px] text-(--ink)">{issuedPassword}</code>
            <TextButton
              onClick={() => {
                if (issuedPassword) navigator.clipboard?.writeText(issuedPassword);
                setCopied(true);
              }}
              aria-label="Copy password"
            >
              {copied ? <Check className="size-4" /> : <Copy className="size-4" />}
            </TextButton>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
