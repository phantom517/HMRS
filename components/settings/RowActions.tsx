"use client";

// components/settings/RowActions.tsx — shared Edit / More-actions control.
import { MoreHorizontal, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

export function TextButton({
  className,
  ...props
}: React.ComponentProps<typeof Button>) {
  return (
    <Button
      variant="ghost"
      className={`h-8 px-2 text-[13px] font-medium text-(--ink-secondary) hover:bg-(--linen) hover:text-(--ink) ${className ?? ""}`}
      {...props}
    />
  );
}

export function RowActions({
  onEdit,
  canDelete,
  active,
  onDeactivate,
  onDelete,
  onDeleteDisabled,
  deleteDisabledReason,
  deleteLabel = "Delete",
  name,
}: {
  onEdit: () => void;
  canDelete: boolean;
  active: boolean;
  onDeactivate: () => void;
  onDelete?: () => void;
  onDeleteDisabled?: boolean;
  deleteDisabledReason?: string;
  deleteLabel?: string;
  name?: string;
}) {
  return (
    <div className="flex items-center justify-end gap-2">
      <TextButton onClick={onEdit} aria-label={name ? `Edit ${name}` : "Edit"}>
        <Pencil className="size-4" />
        Edit
      </TextButton>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon"
              className="size-8 text-(--ink-secondary)"
              aria-label={name ? `More actions for ${name}` : "More actions"}
            >
              <MoreHorizontal />
            </Button>
          }
        />
        <DropdownMenuContent align="end" className="w-46">
          <DropdownMenuItem onClick={onDeactivate} disabled={!canDelete}>
            {active ? "Deactivate" : "Activate"}
          </DropdownMenuItem>
          {onDelete && (
            // Native title exposes the reason the delete is visually disabled.
            <div title={onDeleteDisabled ? deleteDisabledReason : undefined}>
              <DropdownMenuItem
                disabled={onDeleteDisabled}
                className="text-(--critical-text) focus:text-(--critical-text) focus:bg-(--critical-bg)"
                onClick={onDelete}
              >
                {deleteLabel}
              </DropdownMenuItem>
            </div>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
