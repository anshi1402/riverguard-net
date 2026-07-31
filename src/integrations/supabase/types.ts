export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      ai_alerts: {
        Row: {
          confidence: number | null
          description: string | null
          detected_at: string
          district_id: string
          id: string
          lat: number | null
          lng: number | null
          severity: Database["public"]["Enums"]["complaint_severity"]
          source: string
          title: string
          water_body_id: string | null
        }
        Insert: {
          confidence?: number | null
          description?: string | null
          detected_at?: string
          district_id: string
          id?: string
          lat?: number | null
          lng?: number | null
          severity?: Database["public"]["Enums"]["complaint_severity"]
          source: string
          title: string
          water_body_id?: string | null
        }
        Update: {
          confidence?: number | null
          description?: string | null
          detected_at?: string
          district_id?: string
          id?: string
          lat?: number | null
          lng?: number | null
          severity?: Database["public"]["Enums"]["complaint_severity"]
          source?: string
          title?: string
          water_body_id?: string | null
        }
        Relationships: []
      }
      complaint_events: {
        Row: {
          action: string
          actor_id: string | null
          complaint_id: string
          created_at: string
          id: string
          notes: string | null
          photo_url: string | null
        }
        Insert: {
          action: string
          actor_id?: string | null
          complaint_id: string
          created_at?: string
          id?: string
          notes?: string | null
          photo_url?: string | null
        }
        Update: {
          action?: string
          actor_id?: string | null
          complaint_id?: string
          created_at?: string
          id?: string
          notes?: string | null
          photo_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "complaint_events_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: false
            referencedRelation: "complaints"
            referencedColumns: ["id"]
          },
        ]
      }
      complaints: {
        Row: {
          assigned_officer_id: string | null
          citizen_id: string
          code: string
          created_at: string
          current_rank: string
          description: string
          district_id: string
          escalation_level: number
          id: string
          image_url: string | null
          last_escalated_at: string | null
          lat: number | null
          lng: number | null
          reinvestigation_count: number
          reinvestigation_reason: string | null
          resolution_notes: string | null
          resolution_photo_url: string | null
          resolved_at: string | null
          severity: Database["public"]["Enums"]["complaint_severity"]
          sla_deadline: string
          status: Database["public"]["Enums"]["complaint_status"]
          type: Database["public"]["Enums"]["complaint_type"]
          updated_at: string
          water_body_id: string
        }
        Insert: {
          assigned_officer_id?: string | null
          citizen_id: string
          code?: string
          created_at?: string
          current_rank?: string
          description: string
          district_id: string
          escalation_level?: number
          id?: string
          image_url?: string | null
          last_escalated_at?: string | null
          lat?: number | null
          lng?: number | null
          reinvestigation_count?: number
          reinvestigation_reason?: string | null
          resolution_notes?: string | null
          resolution_photo_url?: string | null
          resolved_at?: string | null
          severity?: Database["public"]["Enums"]["complaint_severity"]
          sla_deadline?: string
          status?: Database["public"]["Enums"]["complaint_status"]
          type: Database["public"]["Enums"]["complaint_type"]
          updated_at?: string
          water_body_id: string
        }
        Update: {
          assigned_officer_id?: string | null
          citizen_id?: string
          code?: string
          created_at?: string
          current_rank?: string
          description?: string
          district_id?: string
          escalation_level?: number
          id?: string
          image_url?: string | null
          last_escalated_at?: string | null
          lat?: number | null
          lng?: number | null
          reinvestigation_count?: number
          reinvestigation_reason?: string | null
          resolution_notes?: string | null
          resolution_photo_url?: string | null
          resolved_at?: string | null
          severity?: Database["public"]["Enums"]["complaint_severity"]
          sla_deadline?: string
          status?: Database["public"]["Enums"]["complaint_status"]
          type?: Database["public"]["Enums"]["complaint_type"]
          updated_at?: string
          water_body_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "complaints_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "complaints_water_body_id_fkey"
            columns: ["water_body_id"]
            isOneToOne: false
            referencedRelation: "water_bodies"
            referencedColumns: ["id"]
          },
        ]
      }
      districts: {
        Row: {
          created_at: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          complaint_id: string | null
          created_at: string
          id: string
          read: boolean
          title: string
          user_id: string
        }
        Insert: {
          body?: string | null
          complaint_id?: string | null
          created_at?: string
          id?: string
          read?: boolean
          title: string
          user_id: string
        }
        Update: {
          body?: string | null
          complaint_id?: string | null
          created_at?: string
          id?: string
          read?: boolean
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_complaint_id_fkey"
            columns: ["complaint_id"]
            isOneToOne: false
            referencedRelation: "complaints"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          district_id: string | null
          full_name: string | null
          id: string
          officer_rank: string | null
          on_duty: boolean
          phone: string | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          district_id?: string | null
          full_name?: string | null
          id: string
          officer_rank?: string | null
          on_duty?: boolean
          phone?: string | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          district_id?: string | null
          full_name?: string | null
          id?: string
          officer_rank?: string | null
          on_duty?: boolean
          phone?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      water_bodies: {
        Row: {
          created_at: string
          district_id: string
          id: string
          lat: number | null
          lng: number | null
          name: string
          risk_level: Database["public"]["Enums"]["complaint_severity"]
          type: string
        }
        Insert: {
          created_at?: string
          district_id: string
          id?: string
          lat?: number | null
          lng?: number | null
          name: string
          risk_level?: Database["public"]["Enums"]["complaint_severity"]
          type: string
        }
        Update: {
          created_at?: string
          district_id?: string
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string
          risk_level?: Database["public"]["Enums"]["complaint_severity"]
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "water_bodies_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "districts"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      escalate_overdue_complaints: { Args: never; Returns: number }
      get_user_district: { Args: { _user_id: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      notify_sla_warnings: { Args: never; Returns: number }
      sla_hours_for_rank: { Args: { _rank: string }; Returns: number }
    }
    Enums: {
      app_role: "admin" | "officer" | "citizen"
      complaint_severity: "low" | "medium" | "high" | "critical"
      complaint_status:
        | "submitted"
        | "assigned"
        | "in_progress"
        | "resolved"
        | "sla_breached"
        | "reinvestigating"
        | "escalated"
        | "pending"
        | "under_verification"
        | "rejected"
        | "closed"
      complaint_type:
        | "encroachment"
        | "water_contamination"
        | "dead_fish"
        | "oil_spill"
        | "sewage"
        | "illegal_dumping"
        | "other"
        | "supply_channel"
        | "surplus_channel"
        | "water_flow_obstruction"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "officer", "citizen"],
      complaint_severity: ["low", "medium", "high", "critical"],
      complaint_status: [
        "submitted",
        "assigned",
        "in_progress",
        "resolved",
        "sla_breached",
        "reinvestigating",
        "escalated",
        "pending",
        "under_verification",
        "rejected",
        "closed",
      ],
      complaint_type: [
        "encroachment",
        "water_contamination",
        "dead_fish",
        "oil_spill",
        "sewage",
        "illegal_dumping",
        "other",
        "supply_channel",
        "surplus_channel",
        "water_flow_obstruction",
      ],
    },
  },
} as const
