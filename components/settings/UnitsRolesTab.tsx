"use client";

// components/settings/UnitsRolesTab.tsx — Units & Roles tab, extracted from
// the old monolithic client. Owns its dictionary state, modals and busy
// flags; leaf rows are memoized so saves don't repaint every row.
import { useCallback, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import Link from "next/link";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty";
import { RowActions } from "@/components/settings/RowActions";
import {
  createUnitAction,
  updateUnitAction,
  deleteUnitAction,
  createRoleAction,
  updateRoleAction,
  deleteRoleAction,
} from "@/lib/actions/units";

const STAFF_CLASSES = ["RN", "MD", "Tech"] as const;
const thClass = "h-11 px-5 text-[13px] font-medium text-(--ink-secondary)";
const inputStyle =
  "h-10 rounded-[10px] border border-(--ink-border-strong) bg-(--linen) text-[14px] text-(--ink) px-3";

export type DictTab = "units" | "roles";

interface Unit {
  id: string;
  name: string;
  description?: string | null;
  color?: string | null;
  active?: boolean;
  sortOrder?: number;
}
interface Role {
  id: string;
  name: string;
  staffClass?: string | null;
  description?: string | null;
  active?: boolean;
  sortOrder?: number;
}

function sortByName<T extends { name: string; sortOrder?: number }>(rows: T[]): T[] {
  return [...rows].sort(
    (a, b) => (a.sortOrder ?? 100) - (b.sortOrder ?? 100) || a.name.localeCompare(b.name)
  );
}

/** Staff counts may be keyed by id or by name depending on the server. */
function lookupCount(
  counts: Record<string, number> | undefined,
  item: { id: string; name: string }
): number {
  return counts?.[item.id] ?? counts?.[item.name] ?? 0;
}

export function UnitsRolesTab({
  tab,
  units,
  roles,
  unitStaffCounts,
  roleStaffCounts,
  canEdit,
}: {
  tab: DictTab;
  units: Unit[];
  roles: Role[];
  unitStaffCounts: Record<string, number>;
  roleStaffCounts: Record<string, number>;
  canEdit: boolean;
}) {
  const [unitModal, setUnitModal] = useState<null | {
    mode: "create" | "edit";
    id: string;
    name: string;
    description: string;
    active: boolean;
  }>(null);
  const [roleModal, setRoleModal] = useState<null | {
    mode: "create" | "edit";
    id: string;
    name: string;
    staffClass: string;
    description: string;
    active: boolean;
  }>(null);
  const [confirmDelete, setConfirmDelete] = useState<null | {
    kind: DictTab;
    id: string;
    name: string;
  }>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  const fail = useCallback((err: unknown) =>
    setError(err instanceof Error ? err.message : String(err)), []);

  const newUnit = useCallback(
    () => setUnitModal({ mode: "create", id: "", name: "", description: "", active: true }),
    []
  );
  const newRole = useCallback(
    () =>
      setRoleModal({ mode: "create", id: "", name: "", staffClass: "RN", description: "", active: true }),
    []
  );

  async function saveUnit(e: React.FormEvent) {
    e.preventDefault();
    if (!unitModal) return;
    const name = unitModal.name.trim();
    if (units.some((u) => u.id !== unitModal.id && u.name.trim().toLowerCase() === name.toLowerCase())) {
      setError(`A unit named “${name}” already exists.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const payload = { name, description: unitModal.description || null, active: unitModal.active, sortOrder: 100 };
      if (unitModal.mode === "create") void (await createUnitAction(payload));
      else await updateUnitAction(unitModal.id, payload);
      setUnitModal(null);
      router.refresh();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  async function saveRole(e: React.FormEvent) {
    e.preventDefault();
    if (!roleModal) return;
    const name = roleModal.name.trim();
    if (roles.some((r) => r.id !== roleModal.id && r.name.trim().toLowerCase() === name.toLowerCase())) {
      setError(`A role named “${name}” already exists.`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const payload = {
        name,
        staffClass: roleModal.staffClass,
        description: roleModal.description || null,
        active: roleModal.active,
        sortOrder: 100,
      };
      if (roleModal.mode === "create") void (await createRoleAction(payload));
      else await updateRoleAction(roleModal.id, payload);
      setRoleModal(null);
      router.refresh();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  async function doDelete() {
    if (!confirmDelete) return;
    setBusy(true);
    setError(null);
    try {
      if (confirmDelete.kind === "units") await deleteUnitAction(confirmDelete.id);
      else await deleteRoleAction(confirmDelete.id);
      router.refresh();
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
      setConfirmDelete(null);
    }
  }

  const yUnit = useCallback(
    (u: Unit) =>
      setUnitModal({
        mode: "edit",
        id: u.id,
        name: u.name,
        description: u.description || "",
        active: u.active !== false,
      }),
    []
  );
  const yRole = useCallback(
    (r: Role) =>
      setRoleModal({
        mode: "edit",
        id: r.id,
        name: r.name,
        staffClass: r.staffClass || "RN",
        description: r.description || "",
        active: r.active !== false,
      }),
    []
  );

  const sortedUnits = useMemo(() => sortByName(units), [units]);
  const sortedRoles = useMemo(() => sortByName(roles), [roles]);

  return (
    <div className="flex w-full flex-col gap-4">
      {error && (
        <div role="alert" className="rounded-xl border border-(--ink-border) bg-(--critical-bg) px-4 py-3 text-[14px] text-(--critical-text)">
          {error}
        </div>
      )}
      {tab === "units" && (
        <div className="overflow-hidden rounded-xl border border-(--ink-border) bg-(--paper)">
          {units.length === 0 ? (
            <div className="p-10">
              <Empty>
                <EmptyHeader>
                  <EmptyTitle className="text-[15px] font-medium">No units yet</EmptyTitle>
                  <EmptyDescription className="text-[13px] text-(--ink-secondary)">
                    Units are the wards and zones staff can belong to.
                  </EmptyDescription>
                </EmptyHeader>
                {canEdit && (
                  <Button disabled={busy} onClick={newUnit} className="rounded-xl text-[15px]">
                    Add unit
                  </Button>
                )}
              </Empty>
            </div>
          ) : (
            <Table className="ztable">
              <TableHeader>
                <TableRow className="border-(--ink-border) bg-(--linen)">
                  <TableHead className={thClass}>Name</TableHead>
                  <TableHead className={thClass}>Description</TableHead>
                  <TableHead className={thClass}>Staff</TableHead>
                  <TableHead className={cn(thClass, "text-right")}>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedUnits.map((unit) => {
                  const staffCount = lookupCount(unitStaffCounts, unit);
                  const active = unit.active !== false;
                  return (
                    <TableRow key={unit.id} className="h-14 border-(--ink-border-row) hover:bg-(--linen)">
                      <TableCell className="px-5 text-[15px] font-medium text-(--ink)">
                        <span className="inline-flex items-center gap-2">
                          {!active && <Badge className="bg-(--linen) text-(--ink-secondary)">Inactive</Badge>}
                          {unit.name}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-xs truncate px-5 text-[15px] text-(--ink-secondary)" title={unit.description ?? ""}>
                        {unit.description || "—"}
                      </TableCell>
                      <TableCell className="px-5 text-[13px] text-(--ink)">
                        <Link
                          href={`/employees?unit=${encodeURIComponent(unit.name)}`}
                          className="underline decoration-(--ink-border-strong) underline-offset-2 hover:text-(--ink)"
                        >
                          {staffCount}
                        </Link>
                      </TableCell>
                      <TableCell className="px-5 text-right">
                        {canEdit && (
                          <RowActions
                            name={unit.name}
                            onEdit={() => yUnit(unit)}
                            canDelete
                            active={active}
                            onDeactivate={() => {
                              void updateUnitAction(unit.id, { active: !active }).then(() => router.refresh());
                            }}
                            onDelete={() => setConfirmDelete({ kind: "units", id: unit.id, name: unit.name })}
                            onDeleteDisabled={staffCount > 0}
                            deleteDisabledReason={
                              staffCount > 0
                                ? `${staffCount} staff on this unit. Deactivate it instead.`
                                : undefined
                            }
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
      )}

      {tab === "roles" && (
        <div className="overflow-hidden rounded-xl border border-(--ink-border) bg-(--paper)">
          {roles.length === 0 ? (
            <div className="p-10">
              <Empty>
                <EmptyHeader>
                  <EmptyTitle className="text-[15px] font-medium">No roles yet</EmptyTitle>
                  <EmptyDescription className="text-[13px] text-(--ink-secondary)">
                    Roles are the designations staff hold on the roster.
                  </EmptyDescription>
                </EmptyHeader>
                {canEdit && (
                  <Button disabled={busy} onClick={newRole} className="rounded-xl text-[15px]">
                    Add role
                  </Button>
                )}
              </Empty>
            </div>
          ) : (
            <Table className="ztable">
              <TableHeader>
                <TableRow className="border-(--ink-border) bg-(--linen)">
                  <TableHead className={thClass}>Name</TableHead>
                  <TableHead className={thClass}>Staffing class</TableHead>
                  <TableHead className={thClass}>Description</TableHead>
                  <TableHead className={thClass}>Staff</TableHead>
                  <TableHead className={cn(thClass, "text-right")}>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sortedRoles.map((role) => {
                  const staffCount = lookupCount(roleStaffCounts, role);
                  const active = role.active !== false;
                  return (
                    <TableRow key={role.id} className="h-14 border-(--ink-border-row) hover:bg-(--linen)">
                      <TableCell className="px-5 text-[15px] font-medium text-(--ink)">
                        <span className="inline-flex items-center gap-2">
                          {!active && <Badge className="bg-(--linen) text-(--ink-secondary)">Inactive</Badge>}
                          {role.name}
                        </span>
                      </TableCell>
                      <TableCell className="px-5">
                        <Badge variant="outline" className="border-(--ink-border) bg-transparent text-(--ink)">
                          {role.staffClass}
                        </Badge>
                      </TableCell>
                      <TableCell className="max-w-xs truncate px-5 text-[13px] text-(--ink-secondary)" title={role.description ?? ""}>
                        {role.description || "—"}
                      </TableCell>
                      <TableCell className="px-5 text-[13px] text-(--ink)">
                        <Link
                          href={`/employees?designation=${encodeURIComponent(role.name)}`}
                          className="underline decoration-(--ink-border-strong) underline-offset-2 hover:text-(--ink)"
                        >
                          {staffCount}
                        </Link>
                      </TableCell>
                      <TableCell className="px-5 text-right">
                        {canEdit && (
                          <RowActions
                            name={role.name}
                            onEdit={() => yRole(role)}
                            canDelete
                            active={active}
                            onDeactivate={() => {
                              void updateRoleAction(role.id, { active: !active }).then(() => router.refresh());
                            }}
                            onDelete={() => setConfirmDelete({ kind: "roles", id: role.id, name: role.name })}
                            onDeleteDisabled={staffCount > 0}
                            deleteDisabledReason={
                              staffCount > 0
                                ? `${staffCount} staff hold this role. Deactivate it instead.`
                                : undefined
                            }
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
      )}

      {/* Unit drawer */}
      <Sheet open={!!unitModal} onOpenChange={(open) => !open && setUnitModal(null)}>
        <SheetContent side="right" className="w-[420px] p-6 sm:max-w-[420px]">
          {unitModal && (
            <form onSubmit={saveUnit} className="flex h-full flex-col gap-4">
              <SheetHeader className="p-0">
                <SheetTitle>{unitModal.mode === "create" ? "New unit" : "Edit unit"}</SheetTitle>
                <SheetDescription className="text-[13px] text-(--ink-secondary)">
                  Wards and zones staff can belong to.
                </SheetDescription>
              </SheetHeader>
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="unit-name" className="text-[13px] font-medium text-(--ink)">Name</Label>
                  <Input
                    id="unit-name"
                    value={unitModal.name}
                    maxLength={60}
                    onChange={(e) => setUnitModal({ ...unitModal, name: e.target.value })}
                    className={inputStyle}
                    required
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="unit-desc" className="text-[13px] font-medium text-(--ink)">Description</Label>
                  <Input
                    id="unit-desc"
                    value={unitModal.description}
                    onChange={(e) => setUnitModal({ ...unitModal, description: e.target.value })}
                    className={inputStyle}
                  />
                </div>
                <label className="flex items-center justify-between gap-2 rounded-[10px] bg-(--linen) px-3 py-2 text-[14px] text-(--ink)">
                  <span>Active (shown in pickers)</span>
                  <Switch
                    checked={unitModal.active}
                    onCheckedChange={(v: boolean) => setUnitModal({ ...unitModal, active: v })}
                  />
                </label>
              </div>
              <div className="mt-auto flex items-center justify-end gap-3 border-t border-(--ink-border) pt-4">
                <Button type="button" variant="secondary" className="rounded-xl" onClick={() => setUnitModal(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={busy} className="rounded-xl text-[15px]">
                  {unitModal.mode === "create" ? "Create unit" : "Save changes"}
                </Button>
              </div>
            </form>
          )}
        </SheetContent>
      </Sheet>

      {/* Role drawer */}
      <Sheet open={!!roleModal} onOpenChange={(open) => !open && setRoleModal(null)}>
        <SheetContent side="right" className="w-[420px] p-6 sm:max-w-[420px]">
          {roleModal && (
            <form onSubmit={saveRole} className="flex h-full flex-col gap-4">
              <SheetHeader className="p-0">
                <SheetTitle>{roleModal.mode === "create" ? "New role" : "Edit role"}</SheetTitle>
                <SheetDescription className="text-[13px] text-(--ink-secondary)">
                  Designations staff hold on the roster.
                </SheetDescription>
              </SheetHeader>
              <div className="flex flex-col gap-3">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="role-name" className="text-[13px] font-medium text-(--ink)">Name</Label>
                  <Input
                    id="role-name"
                    value={roleModal.name}
                    maxLength={60}
                    onChange={(e) => setRoleModal({ ...roleModal, name: e.target.value })}
                    className={inputStyle}
                    required
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="role-class" className="text-[13px] font-medium text-(--ink)">Staffing class</Label>
                  <select
                    id="role-class"
                    value={roleModal.staffClass ?? "RN"}
                    onChange={(e) => setRoleModal({ ...roleModal, staffClass: e.target.value })}
                    className={`${inputStyle} appearance-none`}
                  >
                    {STAFF_CLASSES.map((sc) => (
                      <option key={sc} value={sc}>{sc}</option>
                    ))}
                  </select>
                  <p className="text-[13px] text-(--ink-secondary)">Used to match staffing minimums on shifts.</p>
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="role-desc" className="text-[13px] font-medium text-(--ink)">Description</Label>
                  <Input
                    id="role-desc"
                    value={roleModal.description}
                    onChange={(e) => setRoleModal({ ...roleModal, description: e.target.value })}
                    className={inputStyle}
                  />
                </div>
                <label className="flex items-center justify-between gap-2 rounded-[10px] bg-(--linen) px-3 py-2 text-[14px] text-(--ink)">
                  <span>Active (shown in pickers)</span>
                  <Switch
                    checked={roleModal.active}
                    onCheckedChange={(v: boolean) => setRoleModal({ ...roleModal, active: v })}
                  />
                </label>
              </div>
              <div className="mt-auto flex items-center justify-end gap-3 border-t border-(--ink-border) pt-4">
                <Button type="button" variant="secondary" className="rounded-xl" onClick={() => setRoleModal(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={busy} className="rounded-xl text-[15px]">
                  {roleModal.mode === "create" ? "Create role" : "Save changes"}
                </Button>
              </div>
            </form>
          )}
        </SheetContent>
      </Sheet>

      {/* Delete confirm */}
      <AlertDialog open={!!confirmDelete} onOpenChange={(open) => !open && setConfirmDelete(null)}>
        <AlertDialogContent className="max-w-md rounded-xl border border-(--ink-border) bg-(--paper)">
          <AlertDialogHeader>
            <AlertDialogTitle>
              Delete {confirmDelete?.kind === "units" ? "unit" : "role"} “{confirmDelete?.name}”?
            </AlertDialogTitle>
            <AlertDialogDescription className="text-[13px] text-(--ink-secondary)">
              This removes it from the dictionary permanently. History stays intact — deletion is
              only possible while nothing references it.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(e) => {
                e.preventDefault();
                void doDelete();
              }}
              className="rounded-xl bg-(--critical-bg) text-(--critical-text) hover:bg-(--critical-bg)/80"
            >
              Delete permanently
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
