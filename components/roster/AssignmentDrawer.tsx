"use client";

import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
  FieldSet,
} from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ZAvatar } from "@/components/shared/ZAvatar";
import { ROSTER_ZONES } from "@/components/roster/rosterFilters";

export interface SelectedCell {
  employee: any;
  date: string;
  dayLabel: string;
  existingAssignment?: any;
}

/* ─── Slide-Over Assignment Drawer (Bottom-Sheet on mobile) ─────────────── */

export function AssignmentDrawer({
  open,
  selectedCell,
  shiftTypes,
  shiftTypeId,
  onShiftTypeIdChange,
  wardZone,
  onWardZoneChange,
  handoverNotes,
  onHandoverNotesChange,
  isSaving,
  onClose,
  onSave,
  onRemove,
}: {
  open: boolean;
  selectedCell: SelectedCell;
  shiftTypes: Array<any>;
  shiftTypeId: string;
  onShiftTypeIdChange: (id: string) => void;
  wardZone: string;
  onWardZoneChange: (zone: string) => void;
  handoverNotes: string;
  onHandoverNotesChange: (notes: string) => void;
  isSaving: boolean;
  onClose: () => void;
  onSave: () => void;
  onRemove: () => void;
}) {
  return (
    <Sheet open={open} onOpenChange={(next) => !next && onClose()}>
      <SheetContent className="flex flex-col justify-between gap-0 overflow-y-auto p-6 sm:max-w-[380px]">
        <div>
          <SheetHeader className="border-b pb-4">
            <SheetTitle>Shift Assignment</SheetTitle>
            <SheetDescription>{selectedCell.date}</SheetDescription>
            <div className="mt-4 flex items-center gap-3 border-b pb-4">
              <ZAvatar name={selectedCell.employee.fullName} />
              <div>
                <div className="text-[15px] font-medium text-foreground">
                  {selectedCell.employee.fullName}
                </div>
                <div className="text-xs text-muted-foreground">
                  {selectedCell.employee.employeeId} · {selectedCell.employee.designation}
                </div>
              </div>
            </div>
          </SheetHeader>

          <form
            className="mt-4"
            onSubmit={(e) => {
              e.preventDefault();
              onSave();
            }}
          >
            <FieldGroup>
              <FieldSet>
                <Field>
                  <FieldLabel>Shift Template</FieldLabel>
                  <ToggleGroup
                    value={[shiftTypeId]}
                    onValueChange={(value) => {
                      const next = value[0];
                      if (next) onShiftTypeIdChange(next);
                    }}
                    spacing={8}
                    className="grid w-full grid-cols-2 gap-2"
                  >
                    {shiftTypes.slice(0, 4).map((st) => (
                      <ToggleGroupItem
                        key={st.id}
                        value={st.id}
                        variant="outline"
                        size="sm"
                        className="h-auto flex-col items-start justify-start gap-0.5 rounded-xl px-3 py-2.5 text-left data-[pressed=true]:text-foreground"
                      >
                        <span className="text-[13px] font-medium leading-normal">
                          [{st.shortCode}] {st.name}
                        </span>
                        <span className="text-[11px] text-muted-foreground">
                          {st.startTime}–{st.endTime}
                        </span>
                      </ToggleGroupItem>
                    ))}
                  </ToggleGroup>
                  <FieldDescription>Pick the shift pattern for this slot.</FieldDescription>
                </Field>
              </FieldSet>

              <Field>
                <FieldLabel>Care Zone</FieldLabel>
                <Select
                  value={wardZone}
                  onValueChange={(value) => onWardZoneChange(value ?? wardZone)}
                >
                  <SelectTrigger className="h-10 rounded-xl w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ROSTER_ZONES.map((z) => (
                      <SelectItem key={z} value={z}>
                        {z}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field>
                <FieldLabel>Handover Notes</FieldLabel>
                <Textarea
                  value={handoverNotes}
                  onChange={(e) => onHandoverNotesChange(e.target.value)}
                  rows={3}
                  placeholder="e.g. Lead resuscitation team until 13:00…"
                  className="rounded-xl"
                />
              </Field>
            </FieldGroup>
          </form>
        </div>

        <SheetFooter className="border-t pb-0">
          <Button
            type="button"
            onClick={onSave}
            disabled={isSaving}
            className="h-10 w-full rounded-xl"
          >
            {isSaving ? "Saving…" : selectedCell.existingAssignment ? "Update assignment" : "Commit shift slot"}
          </Button>
          {selectedCell.existingAssignment && (
            <Button
              type="button"
              variant="ghost"
              onClick={onRemove}
              disabled={isSaving}
              className="text-destructive"
            >
              Delete assignment
            </Button>
          )}
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
