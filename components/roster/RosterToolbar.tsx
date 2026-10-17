"use client";

import { FileText, Search, ShieldCheck, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";

export type RosterViewMode = "grid" | "weekly" | "coverage";

const VIEW_OPTIONS: ReadonlyArray<{ id: RosterViewMode; label: string }> = [
  { id: "grid", label: "Grid" },
  { id: "weekly", label: "Weekly" },
  { id: "coverage", label: "Coverage" },
];

/* ─── Toolbar: view switcher, search, filters, actions ──────────────────── */

export function RosterToolbar({
  viewMode,
  onViewModeChange,
  searchQuery,
  onSearchQueryChange,
  selectedRole,
  onRoleChange,
  selectedZone,
  onZoneChange,
  canManageShifts,
  onSmartFill,
  isSmartFilling,
  canExportReports,
  onOpenExportModal,
}: {
  viewMode: RosterViewMode;
  onViewModeChange: (mode: RosterViewMode) => void;
  searchQuery: string;
  onSearchQueryChange: (q: string) => void;
  selectedRole: string;
  onRoleChange: (role: string) => void;
  selectedZone: string;
  onZoneChange: (zone: string) => void;
  canManageShifts: boolean;
  onSmartFill: () => void;
  isSmartFilling: boolean;
  canExportReports: boolean;
  onOpenExportModal: () => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3">
      {/* View switcher: segmented control, text only */}
      <ToggleGroup
        value={[viewMode]}
        onValueChange={(value) => {
          const next = value[0];
          if (next) onViewModeChange(next as RosterViewMode);
        }}
        aria-label="Roster view"
        variant="outline"
        className="rounded-xl border bg-muted p-0.5 shadow-none"
      >
        {VIEW_OPTIONS.map(({ id, label }) => (
          <ToggleGroupItem key={id} value={id} aria-label={label} className="px-4 py-1.5 text-[13px]">
            {label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>

      <div className="relative w-[250px] shrink-0">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          value={searchQuery}
          onChange={(e) => onSearchQueryChange(e.target.value)}
          placeholder="Search staff…"
          className="h-10 rounded-xl pl-8"
        />
      </div>

      <Select
        value={selectedRole}
        onValueChange={(value) => onRoleChange(value ?? selectedRole)}
      >
        <SelectTrigger aria-label="Filter by role" className="h-10 min-w-30 rounded-xl">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">All roles</SelectItem>
          <SelectItem value="MD">Physicians (MD)</SelectItem>
          <SelectItem value="RN">Nurses (RN)</SelectItem>
          <SelectItem value="TECH">Techs</SelectItem>
        </SelectContent>
      </Select>

      <Select
        value={selectedZone}
        onValueChange={(value) => onZoneChange(value ?? selectedZone)}
      >
        <SelectTrigger aria-label="Filter by unit" className="h-10 min-w-33 rounded-xl">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ALL">All units</SelectItem>
          <SelectItem value="Red">Red Zone</SelectItem>
          <SelectItem value="Acute">Yellow Zone</SelectItem>
          <SelectItem value="FastTrack">Green Zone</SelectItem>
        </SelectContent>
      </Select>

      <div className="ml-auto flex shrink-0 items-center gap-3.5">
        {canManageShifts && (
          <Button variant="secondary" onClick={onSmartFill} disabled={isSmartFilling} className="h-10 rounded-xl">
            <ShieldCheck data-icon="inline-start" />
            <span>{isSmartFilling ? "Smart filling…" : "Smart fill week"}</span>
          </Button>
        )}
        {canExportReports && (
          <DropdownMenu>
            <DropdownMenuTrigger render={<Button variant="secondary" className="h-10 rounded-xl">Export</Button>} />
            <DropdownMenuContent align="end" className="w-44">
              <DropdownMenuItem
                render={
                  <a href="/api/export?type=roster&format=csv" className="flex items-center gap-2">
                    <Table2 />
                    Export CSV matrix
                  </a>
                }
              />
              <DropdownMenuItem className="flex items-center gap-2" onSelect={onOpenExportModal}>
                <FileText />
                Printable audit PDF
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </div>
  );
}
