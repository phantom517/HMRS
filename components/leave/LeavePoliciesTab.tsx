"use client";

import { useState } from "react";
import { Check, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

/* ─── TAB 4: Policies ───────────────────────────────────────────────────── */

function PolicyCard({
  policy,
  leaveTypeName,
  isSuperuser,
  isSubmitting,
  onUpdatePolicy,
}: {
  policy: any;
  leaveTypeName: string;
  isSuperuser: boolean;
  isSubmitting: boolean;
  onUpdatePolicy: (policyId: string, allowanceDays: string) => void;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [allowance, setAllowance] = useState(String(policy.allowanceDays));

  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-background p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="text-[15px] font-medium text-foreground">{policy.name}</div>
          <div className="mt-0.5 text-[13px] text-muted-foreground">
            {leaveTypeName} · {policy.employeeCategory || "All staff"}
          </div>
        </div>
        {isSuperuser && !isEditing && (
          <Button
            variant="ghost"
            size="icon-sm"
            title="Edit policy"
            aria-label="Edit policy"
            onClick={() => setIsEditing(true)}
          >
            <Pencil />
          </Button>
        )}
      </div>

      <div className="flex gap-3 pt-3">
        <div className="flex-1">
          <div className="mb-1 text-xs text-muted-foreground">Allowance</div>
          {isEditing ? (
            <div className="flex items-center gap-2">
              <Input
                type="number"
                value={allowance}
                onChange={(e) => setAllowance(e.target.value)}
                className="h-8 w-20"
                aria-label={`Allowance for ${policy.name}`}
              />
              <Button
                variant="secondary"
                size="sm"
                disabled={isSubmitting}
                onClick={() => {
                  onUpdatePolicy(policy.id, allowance);
                  setIsEditing(false);
                }}
              >
                <Check data-icon="inline-start" />
              </Button>
            </div>
          ) : (
            <div className="text-base font-medium tabular-nums text-foreground">
              {policy.allowanceDays} days / yr
            </div>
          )}
        </div>
        <div className="flex-1">
          <div className="mb-1 text-xs text-muted-foreground">Carry-forward</div>
          <div className="text-base font-medium tabular-nums text-foreground">
            {policy.carryForwardDays || 0} days
          </div>
        </div>
      </div>
    </div>
  );
}

export function LeavePoliciesTab({
  policies,
  leaveTypeMap,
  isSuperuser,
  isSubmitting,
  onUpdatePolicy,
}: {
  policies: Array<any>;
  leaveTypeMap: Map<string, any>;
  isSuperuser: boolean;
  isSubmitting: boolean;
  onUpdatePolicy: (policyId: string, allowanceDays: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {policies.map((p) => (
        <PolicyCard
          key={p.id}
          policy={p}
          leaveTypeName={leaveTypeMap.get(p.leaveTypeId)?.name || "Leave"}
          isSuperuser={isSuperuser}
          isSubmitting={isSubmitting}
          onUpdatePolicy={onUpdatePolicy}
        />
      ))}
    </div>
  );
}
