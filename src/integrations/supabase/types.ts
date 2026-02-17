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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      chat_conversations: {
        Row: {
          created_at: string
          id: string
          project_id: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          project_id?: string | null
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          project_id?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chat_conversations_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "chat_projects"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_projects: {
        Row: {
          color: string | null
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      compound_custom_field_values: {
        Row: {
          created_at: string
          custom_field_id: string
          id: string
          updated_at: string
          user_compound_id: string
          value: string
        }
        Insert: {
          created_at?: string
          custom_field_id: string
          id?: string
          updated_at?: string
          user_compound_id: string
          value: string
        }
        Update: {
          created_at?: string
          custom_field_id?: string
          id?: string
          updated_at?: string
          user_compound_id?: string
          value?: string
        }
        Relationships: [
          {
            foreignKeyName: "compound_custom_field_values_custom_field_id_fkey"
            columns: ["custom_field_id"]
            isOneToOne: false
            referencedRelation: "compound_custom_fields"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compound_custom_field_values_user_compound_id_fkey"
            columns: ["user_compound_id"]
            isOneToOne: false
            referencedRelation: "user_compounds"
            referencedColumns: ["id"]
          },
        ]
      }
      compound_custom_fields: {
        Row: {
          affects_calculation: boolean
          calculation_role: string | null
          created_at: string
          default_value: string | null
          field_name: string
          field_type: string
          field_unit: string | null
          id: string
          is_predefined: boolean
          options: Json | null
          sort_order: number
          user_id: string
        }
        Insert: {
          affects_calculation?: boolean
          calculation_role?: string | null
          created_at?: string
          default_value?: string | null
          field_name: string
          field_type?: string
          field_unit?: string | null
          id?: string
          is_predefined?: boolean
          options?: Json | null
          sort_order?: number
          user_id: string
        }
        Update: {
          affects_calculation?: boolean
          calculation_role?: string | null
          created_at?: string
          default_value?: string | null
          field_name?: string
          field_type?: string
          field_unit?: string | null
          id?: string
          is_predefined?: boolean
          options?: Json | null
          sort_order?: number
          user_id?: string
        }
        Relationships: []
      }
      compounds: {
        Row: {
          bacstat_per_vial: number | null
          category: string
          created_at: string
          current_quantity: number
          cycle_off_days: number | null
          cycle_on_days: number | null
          cycle_start_date: string | null
          cycling_note: string | null
          days_per_week: number
          dose_label: string
          dose_per_use: number
          doses_per_day: number
          id: string
          kit_price: number | null
          name: string
          notes: string | null
          purchase_date: string | null
          recon_volume: number | null
          reorder_quantity: number
          timing_note: string | null
          unit_label: string
          unit_price: number
          unit_size: number
          updated_at: string
          vial_size_ml: number | null
        }
        Insert: {
          bacstat_per_vial?: number | null
          category: string
          created_at?: string
          current_quantity?: number
          cycle_off_days?: number | null
          cycle_on_days?: number | null
          cycle_start_date?: string | null
          cycling_note?: string | null
          days_per_week: number
          dose_label: string
          dose_per_use: number
          doses_per_day: number
          id: string
          kit_price?: number | null
          name: string
          notes?: string | null
          purchase_date?: string | null
          recon_volume?: number | null
          reorder_quantity?: number
          timing_note?: string | null
          unit_label: string
          unit_price: number
          unit_size: number
          updated_at?: string
          vial_size_ml?: number | null
        }
        Update: {
          bacstat_per_vial?: number | null
          category?: string
          created_at?: string
          current_quantity?: number
          cycle_off_days?: number | null
          cycle_on_days?: number | null
          cycle_start_date?: string | null
          cycling_note?: string | null
          days_per_week?: number
          dose_label?: string
          dose_per_use?: number
          doses_per_day?: number
          id?: string
          kit_price?: number | null
          name?: string
          notes?: string | null
          purchase_date?: string | null
          recon_volume?: number | null
          reorder_quantity?: number
          timing_note?: string | null
          unit_label?: string
          unit_price?: number
          unit_size?: number
          updated_at?: string
          vial_size_ml?: number | null
        }
        Relationships: []
      }
      feature_requests: {
        Row: {
          created_at: string
          id: string
          is_read: boolean
          request_text: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_read?: boolean
          request_text: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_read?: boolean
          request_text?: string
          user_id?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          compound_id: string
          cost: number
          created_at: string
          id: string
          month_label: string
          ordered_at: string | null
          quantity: number
          received_at: string | null
          status: string
          user_id: string | null
        }
        Insert: {
          compound_id: string
          cost: number
          created_at?: string
          id?: string
          month_label: string
          ordered_at?: string | null
          quantity: number
          received_at?: string | null
          status?: string
          user_id?: string | null
        }
        Update: {
          compound_id?: string
          cost?: number
          created_at?: string
          id?: string
          month_label?: string
          ordered_at?: string | null
          quantity?: number
          received_at?: string | null
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      profiles: {
        Row: {
          age: number | null
          app_features: Json | null
          avatar_url: string | null
          body_fat_pct: number | null
          created_at: string
          display_name: string | null
          dose_unit_preference: string
          gender: string | null
          height_cm: number | null
          id: string
          measurement_system: string
          referred_by: string | null
          updated_at: string
          user_id: string
          weight_kg: number | null
        }
        Insert: {
          age?: number | null
          app_features?: Json | null
          avatar_url?: string | null
          body_fat_pct?: number | null
          created_at?: string
          display_name?: string | null
          dose_unit_preference?: string
          gender?: string | null
          height_cm?: number | null
          id?: string
          measurement_system?: string
          referred_by?: string | null
          updated_at?: string
          user_id: string
          weight_kg?: number | null
        }
        Update: {
          age?: number | null
          app_features?: Json | null
          avatar_url?: string | null
          body_fat_pct?: number | null
          created_at?: string
          display_name?: string | null
          dose_unit_preference?: string
          gender?: string | null
          height_cm?: number | null
          id?: string
          measurement_system?: string
          referred_by?: string | null
          updated_at?: string
          user_id?: string
          weight_kg?: number | null
        }
        Relationships: []
      }
      protocol_chat_messages: {
        Row: {
          content: string
          conversation_id: string | null
          created_at: string
          id: string
          proposal: Json | null
          role: string
          user_id: string
        }
        Insert: {
          content?: string
          conversation_id?: string | null
          created_at?: string
          id?: string
          proposal?: Json | null
          role: string
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string | null
          created_at?: string
          id?: string
          proposal?: Json | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "protocol_chat_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "chat_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      tolerance_history: {
        Row: {
          created_at: string
          id: string
          tolerance_level: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          tolerance_level: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          tolerance_level?: string
          user_id?: string
        }
        Relationships: []
      }
      user_compound_protocols: {
        Row: {
          created_at: string
          id: string
          user_compound_id: string
          user_protocol_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_compound_id: string
          user_protocol_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_compound_id?: string
          user_protocol_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_compound_protocols_user_compound_id_fkey"
            columns: ["user_compound_id"]
            isOneToOne: false
            referencedRelation: "user_compounds"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_compound_protocols_user_protocol_id_fkey"
            columns: ["user_protocol_id"]
            isOneToOne: false
            referencedRelation: "user_protocols"
            referencedColumns: ["id"]
          },
        ]
      }
      user_compounds: {
        Row: {
          bacstat_per_vial: number | null
          category: string
          compound_id: string
          created_at: string
          current_quantity: number
          cycle_off_days: number | null
          cycle_on_days: number | null
          cycle_start_date: string | null
          cycling_note: string | null
          days_per_week: number
          dose_label: string
          dose_per_use: number
          doses_per_day: number
          id: string
          kit_price: number | null
          name: string
          notes: string | null
          pause_restart_date: string | null
          paused_at: string | null
          purchase_date: string | null
          recon_volume: number | null
          reorder_quantity: number
          reorder_type: string
          timing_note: string | null
          unit_label: string
          unit_price: number
          unit_size: number
          updated_at: string
          user_id: string
          vial_size_ml: number | null
          weight_per_unit: number | null
        }
        Insert: {
          bacstat_per_vial?: number | null
          category: string
          compound_id: string
          created_at?: string
          current_quantity?: number
          cycle_off_days?: number | null
          cycle_on_days?: number | null
          cycle_start_date?: string | null
          cycling_note?: string | null
          days_per_week: number
          dose_label: string
          dose_per_use: number
          doses_per_day: number
          id?: string
          kit_price?: number | null
          name: string
          notes?: string | null
          pause_restart_date?: string | null
          paused_at?: string | null
          purchase_date?: string | null
          recon_volume?: number | null
          reorder_quantity?: number
          reorder_type?: string
          timing_note?: string | null
          unit_label: string
          unit_price: number
          unit_size: number
          updated_at?: string
          user_id: string
          vial_size_ml?: number | null
          weight_per_unit?: number | null
        }
        Update: {
          bacstat_per_vial?: number | null
          category?: string
          compound_id?: string
          created_at?: string
          current_quantity?: number
          cycle_off_days?: number | null
          cycle_on_days?: number | null
          cycle_start_date?: string | null
          cycling_note?: string | null
          days_per_week?: number
          dose_label?: string
          dose_per_use?: number
          doses_per_day?: number
          id?: string
          kit_price?: number | null
          name?: string
          notes?: string | null
          pause_restart_date?: string | null
          paused_at?: string | null
          purchase_date?: string | null
          recon_volume?: number | null
          reorder_quantity?: number
          reorder_type?: string
          timing_note?: string | null
          unit_label?: string
          unit_price?: number
          unit_size?: number
          updated_at?: string
          user_id?: string
          vial_size_ml?: number | null
          weight_per_unit?: number | null
        }
        Relationships: []
      }
      user_goal_protocols: {
        Row: {
          created_at: string
          id: string
          user_goal_id: string
          user_protocol_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          user_goal_id: string
          user_protocol_id: string
        }
        Update: {
          created_at?: string
          id?: string
          user_goal_id?: string
          user_protocol_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_goal_protocols_user_goal_id_fkey"
            columns: ["user_goal_id"]
            isOneToOne: false
            referencedRelation: "user_goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_goal_protocols_user_protocol_id_fkey"
            columns: ["user_protocol_id"]
            isOneToOne: false
            referencedRelation: "user_protocols"
            referencedColumns: ["id"]
          },
        ]
      }
      user_goal_readings: {
        Row: {
          created_at: string
          id: string
          notes: string | null
          reading_date: string
          source: string | null
          unit: string
          user_goal_id: string
          user_id: string
          value: number
        }
        Insert: {
          created_at?: string
          id?: string
          notes?: string | null
          reading_date?: string
          source?: string | null
          unit: string
          user_goal_id: string
          user_id: string
          value: number
        }
        Update: {
          created_at?: string
          id?: string
          notes?: string | null
          reading_date?: string
          source?: string | null
          unit?: string
          user_goal_id?: string
          user_id?: string
          value?: number
        }
        Relationships: [
          {
            foreignKeyName: "user_goal_readings_user_goal_id_fkey"
            columns: ["user_goal_id"]
            isOneToOne: false
            referencedRelation: "user_goals"
            referencedColumns: ["id"]
          },
        ]
      }
      user_goal_uploads: {
        Row: {
          ai_extracted_data: Json | null
          created_at: string
          file_name: string
          file_type: string | null
          file_url: string
          id: string
          notes: string | null
          reading_date: string | null
          upload_type: string
          user_goal_id: string
          user_id: string
        }
        Insert: {
          ai_extracted_data?: Json | null
          created_at?: string
          file_name: string
          file_type?: string | null
          file_url: string
          id?: string
          notes?: string | null
          reading_date?: string | null
          upload_type: string
          user_goal_id: string
          user_id: string
        }
        Update: {
          ai_extracted_data?: Json | null
          created_at?: string
          file_name?: string
          file_type?: string | null
          file_url?: string
          id?: string
          notes?: string | null
          reading_date?: string | null
          upload_type?: string
          user_goal_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_goal_uploads_user_goal_id_fkey"
            columns: ["user_goal_id"]
            isOneToOne: false
            referencedRelation: "user_goals"
            referencedColumns: ["id"]
          },
        ]
      }
      user_goals: {
        Row: {
          baseline_date: string | null
          baseline_label: string | null
          baseline_value: number | null
          body_area: string | null
          created_at: string
          current_value: number | null
          description: string | null
          goal_type: string
          id: string
          priority: number | null
          status: string
          target_date: string | null
          target_label: string | null
          target_unit: string | null
          target_value: number | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          baseline_date?: string | null
          baseline_label?: string | null
          baseline_value?: number | null
          body_area?: string | null
          created_at?: string
          current_value?: number | null
          description?: string | null
          goal_type: string
          id?: string
          priority?: number | null
          status?: string
          target_date?: string | null
          target_label?: string | null
          target_unit?: string | null
          target_value?: number | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          baseline_date?: string | null
          baseline_label?: string | null
          baseline_value?: number | null
          body_area?: string | null
          created_at?: string
          current_value?: number | null
          description?: string | null
          goal_type?: string
          id?: string
          priority?: number | null
          status?: string
          target_date?: string | null
          target_label?: string | null
          target_unit?: string | null
          target_value?: number | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_onboarding: {
        Row: {
          ai_conversation: string | null
          completed_at: string | null
          created_at: string
          id: string
          responses: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          ai_conversation?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          responses?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          ai_conversation?: string | null
          completed_at?: string | null
          created_at?: string
          id?: string
          responses?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      user_protocols: {
        Row: {
          created_at: string
          description: string | null
          icon: string
          id: string
          name: string
          notes: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          icon?: string
          id?: string
          name: string
          notes?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          icon?: string
          id?: string
          name?: string
          notes?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
