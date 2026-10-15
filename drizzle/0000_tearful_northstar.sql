CREATE TABLE "assistant_permissions" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"can_edit_employees" boolean DEFAULT false NOT NULL,
	"can_manage_shifts" boolean DEFAULT true NOT NULL,
	"can_assign_shifts" boolean DEFAULT true NOT NULL,
	"can_approve_leave" boolean DEFAULT false NOT NULL,
	"can_manage_policies" boolean DEFAULT false NOT NULL,
	"can_export_reports" boolean DEFAULT true NOT NULL,
	"can_view_audit_logs" boolean DEFAULT false NOT NULL,
	"can_delete_employees" boolean DEFAULT false NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "audit_logs" (
	"id" text PRIMARY KEY NOT NULL,
	"actor_user_id" text,
	"actor_name" text NOT NULL,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text NOT NULL,
	"details" text,
	"previous_values" jsonb,
	"new_values" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "department_settings" (
	"id" text PRIMARY KEY NOT NULL,
	"department_code" text DEFAULT 'DEPT-402' NOT NULL,
	"department_name" text DEFAULT 'Emergency & Trauma Department' NOT NULL,
	"weekly_hours_cap" integer DEFAULT 48 NOT NULL,
	"warning_hours_cap" integer DEFAULT 40 NOT NULL,
	"consecutive_shifts_cap" integer DEFAULT 5 NOT NULL,
	"min_rest_hours_between_shifts" integer DEFAULT 11 NOT NULL,
	"roster_lock_hours_ahead" integer DEFAULT 72 NOT NULL,
	"nurse_to_bed_ratio_target" text DEFAULT '1:3.2' NOT NULL,
	"timezone" text DEFAULT 'America/Chicago' NOT NULL,
	"week_start_day" integer DEFAULT 1 NOT NULL,
	"max_nights_per_month" integer DEFAULT 7 NOT NULL,
	"minimum_staff_rn" integer DEFAULT 0 NOT NULL,
	"max_weekly_hours_severity" text DEFAULT 'warn' NOT NULL,
	"max_nights_severity" text DEFAULT 'warn' NOT NULL,
	"pending_leave_action" text DEFAULT 'warn' NOT NULL,
	"enforce_rest_interval" boolean DEFAULT true NOT NULL,
	"auto_assign_enabled" boolean DEFAULT true NOT NULL,
	"auto_assign_time_budget_ms" integer DEFAULT 2000 NOT NULL,
	"updated_by" text DEFAULT 'Dr. Sarah Jenkins',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "employees" (
	"id" text PRIMARY KEY NOT NULL,
	"employee_id" text NOT NULL,
	"full_name" text NOT NULL,
	"designation" text NOT NULL,
	"department" text DEFAULT 'Emergency & Trauma' NOT NULL,
	"unit" text DEFAULT 'Zone 1: Resuscitation' NOT NULL,
	"phone_number" text NOT NULL,
	"email" text NOT NULL,
	"hospital_ext" text DEFAULT 'x4402',
	"pager_number" text DEFAULT 'PGR-8891',
	"date_joined" text NOT NULL,
	"employment_status" text DEFAULT 'active' NOT NULL,
	"notes" text,
	"avatar_url" text,
	"credentials" jsonb DEFAULT '[]'::jsonb,
	"active" boolean DEFAULT true NOT NULL,
	"archived_at" timestamp,
	"max_hours_per_week" integer,
	"can_work_nights" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "employees_employee_id_unique" UNIQUE("employee_id")
);
--> statement-breakpoint
CREATE TABLE "leave_balance_adjustments" (
	"id" text PRIMARY KEY NOT NULL,
	"employee_id" text NOT NULL,
	"leave_type_id" text NOT NULL,
	"amount" numeric(5, 1) NOT NULL,
	"reason" text NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leave_policies" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"designation" text NOT NULL,
	"leave_type_id" text NOT NULL,
	"allowance_days" numeric(5, 1) DEFAULT '15.0' NOT NULL,
	"policy_period" text DEFAULT 'calendar_year' NOT NULL,
	"carry_forward_days" numeric(5, 1) DEFAULT '5.0' NOT NULL,
	"effective_from" text NOT NULL,
	"effective_to" text,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leave_records" (
	"id" text PRIMARY KEY NOT NULL,
	"employee_id" text NOT NULL,
	"leave_type_id" text NOT NULL,
	"start_date" text NOT NULL,
	"end_date" text NOT NULL,
	"duration_days" numeric(4, 1) NOT NULL,
	"reason" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"replacement_employee_id" text,
	"replacement_status" text DEFAULT 'unassigned',
	"recorded_by" text DEFAULT 'Manager' NOT NULL,
	"reviewed_by" text,
	"reviewed_at" timestamp,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "leave_types" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"code" text NOT NULL,
	"description" text,
	"paid" boolean DEFAULT true NOT NULL,
	"requires_approval" boolean DEFAULT true NOT NULL,
	"color" text DEFAULT '#00685f' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "leave_types_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "off_days" (
	"id" text PRIMARY KEY NOT NULL,
	"employee_id" text NOT NULL,
	"date" text NOT NULL,
	"reason" text DEFAULT 'Rotational Rest Roster' NOT NULL,
	"notes" text,
	"recorded_by" text DEFAULT 'System Roster Engine' NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shift_assignments" (
	"id" text PRIMARY KEY NOT NULL,
	"employee_id" text NOT NULL,
	"shift_type_id" text NOT NULL,
	"date" text NOT NULL,
	"start_at" timestamp NOT NULL,
	"end_at" timestamp NOT NULL,
	"scheduled_break_minutes" integer DEFAULT 30 NOT NULL,
	"status" text DEFAULT 'assigned' NOT NULL,
	"actual_start_at" timestamp,
	"actual_end_at" timestamp,
	"ward_zone" text DEFAULT 'Red Zone (Trauma Resus 1-4)',
	"station_role" text,
	"notes" text,
	"handover_notes" text,
	"conflict_flag" boolean DEFAULT false NOT NULL,
	"conflict_reason" text,
	"created_by" text DEFAULT 'System' NOT NULL,
	"updated_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shift_requirements" (
	"id" text PRIMARY KEY NOT NULL,
	"shift_type_id" text NOT NULL,
	"designation" text DEFAULT 'any' NOT NULL,
	"min_staff" integer DEFAULT 1 NOT NULL,
	"max_staff" integer,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "shift_types" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"short_code" text NOT NULL,
	"description" text,
	"color" text DEFAULT '#00685f' NOT NULL,
	"category" text DEFAULT 'REGULAR' NOT NULL,
	"start_time" text NOT NULL,
	"end_time" text NOT NULL,
	"break_duration_minutes" integer DEFAULT 30 NOT NULL,
	"net_duration_hours" numeric(4, 2) DEFAULT '8.00' NOT NULL,
	"minimum_staff_rn" integer DEFAULT 6 NOT NULL,
	"minimum_staff_md" integer DEFAULT 2 NOT NULL,
	"target_staff" integer DEFAULT 8 NOT NULL,
	"maximum_staff" integer,
	"is_night" boolean DEFAULT false NOT NULL,
	"crosses_midnight" boolean DEFAULT false NOT NULL,
	"enforce_rest_rule" boolean DEFAULT true NOT NULL,
	"trauma_premium" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "shift_types_short_code_unique" UNIQUE("short_code")
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text NOT NULL,
	"role" text DEFAULT 'assistant' NOT NULL,
	"title" text DEFAULT 'Assistant Manager' NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"avatar_url" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "users_email_unique" UNIQUE("email")
);
--> statement-breakpoint
ALTER TABLE "assistant_permissions" ADD CONSTRAINT "assistant_permissions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_balance_adjustments" ADD CONSTRAINT "leave_balance_adjustments_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_balance_adjustments" ADD CONSTRAINT "leave_balance_adjustments_leave_type_id_leave_types_id_fk" FOREIGN KEY ("leave_type_id") REFERENCES "public"."leave_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_policies" ADD CONSTRAINT "leave_policies_leave_type_id_leave_types_id_fk" FOREIGN KEY ("leave_type_id") REFERENCES "public"."leave_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_records" ADD CONSTRAINT "leave_records_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_records" ADD CONSTRAINT "leave_records_leave_type_id_leave_types_id_fk" FOREIGN KEY ("leave_type_id") REFERENCES "public"."leave_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "leave_records" ADD CONSTRAINT "leave_records_replacement_employee_id_employees_id_fk" FOREIGN KEY ("replacement_employee_id") REFERENCES "public"."employees"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "off_days" ADD CONSTRAINT "off_days_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_employee_id_employees_id_fk" FOREIGN KEY ("employee_id") REFERENCES "public"."employees"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_assignments" ADD CONSTRAINT "shift_assignments_shift_type_id_shift_types_id_fk" FOREIGN KEY ("shift_type_id") REFERENCES "public"."shift_types"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "shift_requirements" ADD CONSTRAINT "shift_requirements_shift_type_id_shift_types_id_fk" FOREIGN KEY ("shift_type_id") REFERENCES "public"."shift_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "asst_perm_user_idx" ON "assistant_permissions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "audit_action_idx" ON "audit_logs" USING btree ("action");--> statement-breakpoint
CREATE INDEX "audit_entity_idx" ON "audit_logs" USING btree ("entity_type","entity_id");--> statement-breakpoint
CREATE INDEX "audit_created_idx" ON "audit_logs" USING btree ("created_at");--> statement-breakpoint
CREATE UNIQUE INDEX "employees_emp_id_idx" ON "employees" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "employees_status_idx" ON "employees" USING btree ("employment_status");--> statement-breakpoint
CREATE INDEX "employees_designation_idx" ON "employees" USING btree ("designation");--> statement-breakpoint
CREATE INDEX "leave_adj_emp_idx" ON "leave_balance_adjustments" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "leave_rec_emp_idx" ON "leave_records" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "leave_rec_status_idx" ON "leave_records" USING btree ("status");--> statement-breakpoint
CREATE INDEX "leave_rec_dates_idx" ON "leave_records" USING btree ("start_date","end_date");--> statement-breakpoint
CREATE UNIQUE INDEX "leave_types_code_idx" ON "leave_types" USING btree ("code");--> statement-breakpoint
CREATE INDEX "off_days_emp_idx" ON "off_days" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "off_days_date_idx" ON "off_days" USING btree ("date");--> statement-breakpoint
CREATE UNIQUE INDEX "off_days_emp_date_idx" ON "off_days" USING btree ("employee_id","date");--> statement-breakpoint
CREATE INDEX "shift_assign_emp_idx" ON "shift_assignments" USING btree ("employee_id");--> statement-breakpoint
CREATE INDEX "shift_assign_date_idx" ON "shift_assignments" USING btree ("date");--> statement-breakpoint
CREATE INDEX "shift_assign_type_idx" ON "shift_assignments" USING btree ("shift_type_id");--> statement-breakpoint
CREATE INDEX "shift_assign_status_idx" ON "shift_assignments" USING btree ("status");--> statement-breakpoint
CREATE UNIQUE INDEX "shift_requirements_type_desig_idx" ON "shift_requirements" USING btree ("shift_type_id","designation");--> statement-breakpoint
CREATE UNIQUE INDEX "shift_types_code_idx" ON "shift_types" USING btree ("short_code");--> statement-breakpoint
CREATE UNIQUE INDEX "users_email_idx" ON "users" USING btree ("email");