"use client";

import { AlertTriangle, CheckCircle2, ShieldAlert, X } from "lucide-react";
import { Alert, AlertAction, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export type LiveAlertToast = {
  message: string;
  type: "critical" | "success" | "warning";
};

/* ─── Real-Time Automated Guardrail Alert Banner ────────────────────────── */

export function LiveAlertBanner({
  alert,
  onDismiss,
  onOpenAudit,
  totalAlerts,
}: {
  alert: LiveAlertToast;
  onDismiss: () => void;
  /** Open the guardrail audit details badge (menu button). */
  onOpenAudit: () => void;
  totalAlerts: number;
}) {
  const Icon =
    alert.type === "critical" ? AlertTriangle : alert.type === "warning" ? ShieldAlert : CheckCircle2;

  return (
    <Alert
      role="alert"
      variant={alert.type === "critical" ? "destructive" : "default"}
      className={
        alert.type === "warning"
          ? "bg-secondary text-[#78350f]"
          : alert.type === "success"
          ? "bg-secondary text-foreground"
          : undefined
      }
    >
      <Icon />
      <AlertTitle className="text-current">
        {alert.message}
      </AlertTitle>
      <AlertAction className="top-1.5 right-1.5 flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="font-semibold"
          onClick={onOpenAudit}
        >
          Audit Details ({totalAlerts})
        </Button>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Dismiss alert" onClick={onDismiss}>
          <X />
        </Button>
      </AlertAction>
    </Alert>
  );
}
