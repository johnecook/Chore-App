export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          app_role: Database["public"]["Enums"]["app_role"];
          display_name: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          app_role: Database["public"]["Enums"]["app_role"];
          display_name: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          app_role?: Database["public"]["Enums"]["app_role"];
          display_name?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      households: {
        Row: {
          id: string;
          name: string;
          timezone: string;
          money_features_enabled: boolean;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          timezone?: string;
          money_features_enabled?: boolean;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          timezone?: string;
          money_features_enabled?: boolean;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      household_memberships: {
        Row: {
          id: string;
          household_id: string;
          user_id: string;
          role: Database["public"]["Enums"]["household_role"];
          is_primary_payout_parent: boolean;
          joined_at: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          user_id: string;
          role: Database["public"]["Enums"]["household_role"];
          is_primary_payout_parent?: boolean;
          joined_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          household_id?: string;
          user_id?: string;
          role?: Database["public"]["Enums"]["household_role"];
          is_primary_payout_parent?: boolean;
          joined_at?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      household_invitations: {
        Row: {
          id: string;
          household_id: string;
          email: string;
          role: Database["public"]["Enums"]["household_role"];
          child_display_name: string | null;
          invited_by: string;
          expires_at: string;
          accepted_at: string | null;
          accepted_by: string | null;
          revoked_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          email: string;
          role: Database["public"]["Enums"]["household_role"];
          child_display_name?: string | null;
          invited_by: string;
          expires_at?: string;
          accepted_at?: string | null;
          accepted_by?: string | null;
          revoked_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          household_id?: string;
          email?: string;
          role?: Database["public"]["Enums"]["household_role"];
          child_display_name?: string | null;
          invited_by?: string;
          expires_at?: string;
          accepted_at?: string | null;
          accepted_by?: string | null;
          revoked_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      child_profiles: {
        Row: {
          id: string;
          user_id: string;
          primary_household_id: string;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          primary_household_id: string;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          primary_household_id?: string;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      child_household_availability_windows: {
        Row: {
          id: string;
          child_profile_id: string;
          child_user_id: string;
          household_id: string;
          anchor_date: string;
          cycle_length_days: number;
          available_day_offsets: number[];
          starts_on: string | null;
          ends_on: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          child_profile_id: string;
          child_user_id: string;
          household_id: string;
          anchor_date: string;
          cycle_length_days: number;
          available_day_offsets: number[];
          starts_on?: string | null;
          ends_on?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          child_profile_id?: string;
          child_user_id?: string;
          household_id?: string;
          anchor_date?: string;
          cycle_length_days?: number;
          available_day_offsets?: number[];
          starts_on?: string | null;
          ends_on?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      child_household_availability_overrides: {
        Row: {
          id: string;
          child_profile_id: string;
          child_user_id: string;
          household_id: string;
          override_date: string;
          available: boolean;
          reason: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          child_profile_id: string;
          child_user_id: string;
          household_id: string;
          override_date: string;
          available: boolean;
          reason?: string | null;
          created_by: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          child_profile_id?: string;
          child_user_id?: string;
          household_id?: string;
          override_date?: string;
          available?: boolean;
          reason?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      chore_templates: {
        Row: {
          id: string;
          household_id: string;
          created_by: string;
          title: string;
          description: string | null;
          schedule_type: Database["public"]["Enums"]["chore_schedule_type"];
          start_date: string;
          end_date: string | null;
          weekly_weekdays: number[] | null;
          interval_days: number | null;
          one_off_date: string | null;
          due_time_start: string | null;
          due_time_end: string | null;
          assignment_mode: Database["public"]["Enums"]["chore_assignment_mode"];
          value_model: Database["public"]["Enums"]["chore_value_model"];
          amount_cents: number;
          photo_required: boolean;
          approval_required: boolean;
          active: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          created_by: string;
          title: string;
          description?: string | null;
          schedule_type: Database["public"]["Enums"]["chore_schedule_type"];
          start_date: string;
          end_date?: string | null;
          weekly_weekdays?: number[] | null;
          interval_days?: number | null;
          one_off_date?: string | null;
          due_time_start?: string | null;
          due_time_end?: string | null;
          assignment_mode: Database["public"]["Enums"]["chore_assignment_mode"];
          value_model: Database["public"]["Enums"]["chore_value_model"];
          amount_cents?: number;
          photo_required?: boolean;
          approval_required?: boolean;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          household_id?: string;
          created_by?: string;
          title?: string;
          description?: string | null;
          schedule_type?: Database["public"]["Enums"]["chore_schedule_type"];
          start_date?: string;
          end_date?: string | null;
          weekly_weekdays?: number[] | null;
          interval_days?: number | null;
          one_off_date?: string | null;
          due_time_start?: string | null;
          due_time_end?: string | null;
          assignment_mode?: Database["public"]["Enums"]["chore_assignment_mode"];
          value_model?: Database["public"]["Enums"]["chore_value_model"];
          amount_cents?: number;
          photo_required?: boolean;
          approval_required?: boolean;
          active?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      chore_template_assignees: {
        Row: {
          template_id: string;
          child_profile_id: string;
          created_at: string;
        };
        Insert: {
          template_id: string;
          child_profile_id: string;
          created_at?: string;
        };
        Update: {
          template_id?: string;
          child_profile_id?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      chore_instances: {
        Row: {
          id: string;
          template_id: string;
          earning_household_id: string;
          assigned_child_profile_id: string | null;
          occurrence_date: string;
          due_window_start: string | null;
          due_window_end: string | null;
          value_model_snapshot: Database["public"]["Enums"]["chore_value_model"];
          amount_cents_snapshot: number;
          photo_required_snapshot: boolean;
          approval_required_snapshot: boolean;
          status: Database["public"]["Enums"]["chore_instance_status"];
          up_for_grabs_slot: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          template_id: string;
          earning_household_id: string;
          assigned_child_profile_id?: string | null;
          occurrence_date: string;
          due_window_start?: string | null;
          due_window_end?: string | null;
          value_model_snapshot: Database["public"]["Enums"]["chore_value_model"];
          amount_cents_snapshot?: number;
          photo_required_snapshot: boolean;
          approval_required_snapshot: boolean;
          status: Database["public"]["Enums"]["chore_instance_status"];
          up_for_grabs_slot?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          template_id?: string;
          earning_household_id?: string;
          assigned_child_profile_id?: string | null;
          occurrence_date?: string;
          due_window_start?: string | null;
          due_window_end?: string | null;
          value_model_snapshot?: Database["public"]["Enums"]["chore_value_model"];
          amount_cents_snapshot?: number;
          photo_required_snapshot?: boolean;
          approval_required_snapshot?: boolean;
          status?: Database["public"]["Enums"]["chore_instance_status"];
          up_for_grabs_slot?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      chore_submissions: {
        Row: {
          id: string;
          instance_id: string;
          child_profile_id: string;
          submitted_by: string;
          attempt_number: number;
          note: string | null;
          photo_storage_path: string | null;
          photo_deleted_at: string | null;
          photo_deleted_by: string | null;
          submitted_at: string;
        };
        Insert: {
          id?: string;
          instance_id: string;
          child_profile_id: string;
          submitted_by: string;
          attempt_number: number;
          note?: string | null;
          photo_storage_path?: string | null;
          photo_deleted_at?: string | null;
          photo_deleted_by?: string | null;
          submitted_at?: string;
        };
        Update: {
          id?: string;
          instance_id?: string;
          child_profile_id?: string;
          submitted_by?: string;
          attempt_number?: number;
          note?: string | null;
          photo_storage_path?: string | null;
          photo_deleted_at?: string | null;
          photo_deleted_by?: string | null;
          submitted_at?: string;
        };
        Relationships: [];
      };
      approval_events: {
        Row: {
          id: string;
          instance_id: string;
          submission_id: string | null;
          actor_profile_id: string;
          event_type: Database["public"]["Enums"]["approval_event_type"];
          feedback: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          instance_id: string;
          submission_id?: string | null;
          actor_profile_id: string;
          event_type: Database["public"]["Enums"]["approval_event_type"];
          feedback?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          instance_id?: string;
          submission_id?: string | null;
          actor_profile_id?: string;
          event_type?: Database["public"]["Enums"]["approval_event_type"];
          feedback?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
      pay_periods: {
        Row: {
          id: string;
          household_id: string;
          cycle_type: Database["public"]["Enums"]["pay_cycle_type"];
          start_date: string;
          end_date: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          household_id: string;
          cycle_type: Database["public"]["Enums"]["pay_cycle_type"];
          start_date: string;
          end_date: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          household_id?: string;
          cycle_type?: Database["public"]["Enums"]["pay_cycle_type"];
          start_date?: string;
          end_date?: string;
          created_at?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      payout_events: {
        Row: {
          id: string;
          pay_period_id: string;
          child_profile_id: string;
          payout_household_id: string;
          payout_parent_id: string;
          total_cents: number;
          paid_by: string;
          paid_at: string;
          note: string | null;
        };
        Insert: {
          id?: string;
          pay_period_id: string;
          child_profile_id: string;
          payout_household_id: string;
          payout_parent_id: string;
          total_cents: number;
          paid_by: string;
          paid_at?: string;
          note?: string | null;
        };
        Update: {
          id?: string;
          pay_period_id?: string;
          child_profile_id?: string;
          payout_household_id?: string;
          payout_parent_id?: string;
          total_cents?: number;
          paid_by?: string;
          paid_at?: string;
          note?: string | null;
        };
        Relationships: [];
      };
      ledger_transactions: {
        Row: {
          id: string;
          child_profile_id: string;
          earning_household_id: string | null;
          payout_household_id: string;
          payout_parent_id: string;
          pay_period_id: string | null;
          chore_instance_id: string | null;
          approval_event_id: string | null;
          payout_event_id: string | null;
          transaction_type: Database["public"]["Enums"]["ledger_transaction_type"];
          amount_cents: number;
          description: string | null;
          effective_date: string;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          child_profile_id: string;
          earning_household_id?: string | null;
          payout_household_id: string;
          payout_parent_id: string;
          pay_period_id?: string | null;
          chore_instance_id?: string | null;
          approval_event_id?: string | null;
          payout_event_id?: string | null;
          transaction_type: Database["public"]["Enums"]["ledger_transaction_type"];
          amount_cents: number;
          description?: string | null;
          effective_date: string;
          created_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          child_profile_id?: string;
          earning_household_id?: string | null;
          payout_household_id?: string;
          payout_parent_id?: string;
          pay_period_id?: string | null;
          chore_instance_id?: string | null;
          approval_event_id?: string | null;
          payout_event_id?: string | null;
          transaction_type?: Database["public"]["Enums"]["ledger_transaction_type"];
          amount_cents?: number;
          description?: string | null;
          effective_date?: string;
          created_by?: string;
          created_at?: string;
        };
        Relationships: [];
      };
      chore_template_presets: {
        Row: {
          id: string;
          slug: string;
          category: Database["public"]["Enums"]["chore_template_preset_category"];
          display_order: number;
          title: string;
          description: string | null;
          suggested_schedule_type: Database["public"]["Enums"]["chore_schedule_type"];
          suggested_weekly_weekdays: number[] | null;
          suggested_interval_days: number | null;
          suggested_due_time_start: string | null;
          suggested_due_time_end: string | null;
          suggested_assignment_mode: Database["public"]["Enums"]["chore_assignment_mode"];
          suggested_value_model: Database["public"]["Enums"]["chore_value_model"];
          suggested_amount_cents: number;
          suggested_photo_required: boolean;
          suggested_approval_required: boolean;
          active: boolean;
          created_at: string;
        };
        Insert: {
          id?: string;
          slug: string;
          category: Database["public"]["Enums"]["chore_template_preset_category"];
          display_order?: number;
          title: string;
          description?: string | null;
          suggested_schedule_type: Database["public"]["Enums"]["chore_schedule_type"];
          suggested_weekly_weekdays?: number[] | null;
          suggested_interval_days?: number | null;
          suggested_due_time_start?: string | null;
          suggested_due_time_end?: string | null;
          suggested_assignment_mode?: Database["public"]["Enums"]["chore_assignment_mode"];
          suggested_value_model?: Database["public"]["Enums"]["chore_value_model"];
          suggested_amount_cents?: number;
          suggested_photo_required?: boolean;
          suggested_approval_required?: boolean;
          active?: boolean;
          created_at?: string;
        };
        Update: {
          id?: string;
          slug?: string;
          category?: Database["public"]["Enums"]["chore_template_preset_category"];
          display_order?: number;
          title?: string;
          description?: string | null;
          suggested_schedule_type?: Database["public"]["Enums"]["chore_schedule_type"];
          suggested_weekly_weekdays?: number[] | null;
          suggested_interval_days?: number | null;
          suggested_due_time_start?: string | null;
          suggested_due_time_end?: string | null;
          suggested_assignment_mode?: Database["public"]["Enums"]["chore_assignment_mode"];
          suggested_value_model?: Database["public"]["Enums"]["chore_value_model"];
          suggested_amount_cents?: number;
          suggested_photo_required?: boolean;
          suggested_approval_required?: boolean;
          active?: boolean;
          created_at?: string;
        };
        Relationships: [];
      };
      notification_events: {
        Row: {
          id: string;
          recipient_profile_id: string;
          household_id: string;
          actor_profile_id: string | null;
          chore_instance_id: string | null;
          chore_submission_id: string | null;
          event_type: Database["public"]["Enums"]["notification_event_type"];
          title: string;
          body: string;
          metadata: Json;
          read_at: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          recipient_profile_id: string;
          household_id: string;
          actor_profile_id?: string | null;
          chore_instance_id?: string | null;
          chore_submission_id?: string | null;
          event_type: Database["public"]["Enums"]["notification_event_type"];
          title: string;
          body: string;
          metadata?: Json;
          read_at?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          recipient_profile_id?: string;
          household_id?: string;
          actor_profile_id?: string | null;
          chore_instance_id?: string | null;
          chore_submission_id?: string | null;
          event_type?: Database["public"]["Enums"]["notification_event_type"];
          title?: string;
          body?: string;
          metadata?: Json;
          read_at?: string | null;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      approve_chore_submission: {
        Args: {
          target_submission_id: string;
          target_pay_period_id?: string | null;
          approved_on?: string;
          approval_feedback?: string | null;
        };
        Returns: string;
      };
      approve_chore_submission_for_current_period: {
        Args: {
          target_submission_id: string;
          approved_on?: string;
          approval_feedback?: string | null;
        };
        Returns: string;
      };
      claim_chore_instance: {
        Args: {
          target_instance_id: string;
        };
        Returns: string;
      };
      create_chore_template: {
        Args: {
          target_household_id: string;
          chore_title: string;
          chore_description?: string | null;
          chore_schedule_type?: Database["public"]["Enums"]["chore_schedule_type"];
          chore_start_date?: string;
          chore_weekly_weekdays?: number[] | null;
          chore_interval_days?: number | null;
          chore_one_off_date?: string | null;
          chore_due_time_start?: string | null;
          chore_due_time_end?: string | null;
          chore_assignment_mode?: Database["public"]["Enums"]["chore_assignment_mode"];
          chore_value_model?: Database["public"]["Enums"]["chore_value_model"];
          chore_amount_cents?: number;
          chore_photo_required?: boolean;
          chore_approval_required?: boolean;
          selected_child_profile_ids?: string[];
        };
        Returns: string;
      };
      close_out_payout: {
        Args: {
          target_pay_period_id: string;
          target_child_profile_id: string;
          payout_note?: string | null;
        };
        Returns: string;
      };
      create_manual_adjustment: {
        Args: {
          target_child_profile_id: string;
          target_amount_cents: number;
          adjustment_description: string;
          effective_on?: string;
          target_pay_period_id?: string | null;
        };
        Returns: string;
      };
      create_parent_household: {
        Args: {
          household_name: string;
          household_timezone?: string;
          money_features_enabled?: boolean;
          pay_weekday?: number | null;
          pay_cycle?: Database["public"]["Enums"]["pay_cycle_type"] | null;
          biweekly_anchor_date?: string | null;
        };
        Returns: string;
      };
      create_child_invitation: {
        Args: {
          target_household_id: string;
          child_email: string;
          child_display_name?: string | null;
        };
        Returns: string;
      };
      create_parent_invitation: {
        Args: {
          target_household_id: string;
          parent_email: string;
        };
        Returns: string;
      };
      accept_child_invitation: {
        Args: {
          target_invitation_id: string;
        };
        Returns: string;
      };
      accept_parent_invitation: {
        Args: {
          target_invitation_id: string;
        };
        Returns: string;
      };
      upsert_child_availability_window: {
        Args: {
          target_child_profile_id: string;
          target_household_id: string;
          target_anchor_date: string;
          target_cycle_length_days: number;
          target_available_day_offsets: number[];
          target_starts_on?: string | null;
          target_ends_on?: string | null;
        };
        Returns: string;
      };
      upsert_child_availability_override: {
        Args: {
          target_child_profile_id: string;
          target_household_id: string;
          target_override_date: string;
          target_available: boolean;
          target_reason?: string | null;
        };
        Returns: string;
      };
      delete_child_availability_override: {
        Args: {
          target_override_id: string;
        };
        Returns: undefined;
      };
      delete_submission_photo: {
        Args: {
          target_submission_id: string;
        };
        Returns: undefined;
      };
      enqueue_notification_event: {
        Args: {
          target_recipient_profile_id: string;
          target_household_id: string;
          target_actor_profile_id: string | null;
          target_chore_instance_id: string | null;
          target_chore_submission_id: string | null;
          target_event_type: Database["public"]["Enums"]["notification_event_type"];
          target_title: string;
          target_body: string;
          target_metadata?: Json;
        };
        Returns: string;
      };
      expire_overdue_chore_instances: {
        Args: {
          reference_time?: string;
        };
        Returns: number;
      };
      generate_chore_instances_for_range: {
        Args: {
          range_start?: string;
          range_end?: string;
        };
        Returns: number;
      };
      mark_notification_events_read: {
        Args: {
          target_notification_id?: string | null;
        };
        Returns: number;
      };
      reject_chore_submission: {
        Args: {
          target_submission_id: string;
          rejection_feedback: string;
        };
        Returns: string;
      };
      reopen_chore_instance: {
        Args: {
          target_instance_id: string;
          reopen_feedback?: string | null;
        };
        Returns: string;
      };
      revoke_household_invitation: {
        Args: {
          target_invitation_id: string;
        };
        Returns: undefined;
      };
      submit_chore_instance: {
        Args: {
          target_instance_id: string;
          submission_note?: string | null;
          submission_photo_storage_path?: string | null;
          auto_approve_pay_period_id?: string | null;
          submitted_on?: string;
        };
        Returns: string;
      };
    };
    Enums: {
      app_role: "parent" | "child";
      approval_event_type: "approved" | "rejected" | "reopened";
      chore_assignment_mode: "selected_children" | "all_eligible_children" | "up_for_grabs";
      chore_instance_status: "available" | "assigned" | "submitted" | "approved" | "rejected" | "expired";
      chore_schedule_type: "daily" | "weekly" | "interval" | "one_off";
      chore_template_preset_category:
        | "kitchen"
        | "bedroom"
        | "bathroom"
        | "laundry"
        | "pets"
        | "outdoor"
        | "family";
      chore_value_model: "fixed" | "allowance_included" | "unpaid";
      household_role: "admin" | "parent" | "child";
      ledger_transaction_type: "pending_credit" | "approved_credit" | "manual_adjustment" | "payout";
      monthly_ordinal: "1" | "2" | "3" | "4" | "last";
      notification_event_type:
        | "chore_available"
        | "chore_submitted"
        | "chore_approved"
        | "chore_rejected"
        | "chore_reopened";
      pay_cycle_type: "weekly" | "biweekly" | "monthly_date" | "monthly_weekday";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
