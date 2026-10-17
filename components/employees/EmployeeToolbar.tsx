"use client";

import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SegmentedTabs } from "@/components/layout/PageHeader";

/* ─── Toolbar: tabs left, search + filters right, never wraps ───────────── */

export function EmployeeToolbar({
  statusFilter,
  onStatusFilterChange,
  tabCounts,
  searchQuery,
  onSearchQueryChange,
  selectedRole,
  onRoleChange,
  selectedUnit,
  onUnitChange,
  employees,
  onClearFilters,
}: {
  statusFilter: "all" | "active" | "on_leave" | "archived";
  onStatusFilterChange: (status: "all" | "active" | "on_leave" | "archived") => void;
  tabCounts: { all: number; active: number; on_leave: number; archived: number };
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  selectedRole: string;
  onRoleChange: (role: string) => void;
  selectedUnit: string;
  onUnitChange: (unit: string) => void;
  employees: Array<any>;
  onClearFilters: () => void;
}) {
  const hasActiveFilters =
    searchQuery.trim() !== "" || selectedUnit !== "ALL" || selectedRole !== "ALL";

  return (
    <div className="mb-4 flex flex-wrap items-center gap-3">
      <SegmentedTabs
        active={statusFilter}
        onChange={(id) => onStatusFilterChange(id as any)}
        tabs={[
          { id: "all", label: "All", count: tabCounts.all },
          { id: "active", label: "On duty", count: tabCounts.active },
          { id: "on_leave", label: "On leave", count: tabCounts.on_leave },
          { id: "archived", label: "Archived", count: tabCounts.archived },
        ]}
      />

      <div className="relative w-55 shrink-0">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchQueryChange(e.target.value)}
          placeholder="Search staff…"
          className="h-10 rounded-xl pl-8"
        />
      </div>

      <Select value={selectedRole} onValueChange={(value) => onRoleChange(value ?? "ALL")}>
        <SelectTrigger aria-label="Filter by role" className="h-10 min-w-28 rounded-xl">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">All roles</SelectItem>
          <SelectItem value="MD">Physicians</SelectItem>
          <SelectItem value="RN">Nurses</SelectItem>
          <SelectItem value="TECH">Techs</SelectItem>
        </SelectContent>
      </Select>

      <Select value={selectedUnit} onValueChange={(value) => onUnitChange(value ?? "ALL")}>
        <SelectTrigger aria-label="Filter by unit" className="h-10 min-w-30 rounded-xl">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">All units</SelectItem>
          {Array.from(new Set(employees.map((e) => e.unit)))
            .filter(Boolean)
            .map((u) => (
              <SelectItem key={u} value={u}>
                {u}
              </SelectItem>
            ))}
        </SelectContent>
      </Select>

      {hasActiveFilters && (
        <Button variant="ghost" size="sm" onClick={onClearFilters}>
          Clear
        </Button>
      )}
    </div>
  );
}
