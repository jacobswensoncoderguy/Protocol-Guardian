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
          avatar_url: string | null
          created_at: string
          display_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      protocol_chat_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          proposal: Json | null
          role: string
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          id?: string
          proposal?: Json | null
          role: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          proposal?: Json | null
          role?: string
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
          purchase_date: string | null
          recon_volume: number | null
          reorder_quantity: number
          timing_note: string | null
          unit_label: string
          unit_price: number
          unit_size: number
          updated_at: string
          user_id: string
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
          purchase_date?: string | null
          recon_volume?: number | null
          reorder_quantity?: number
          timing_note?: string | null
          unit_label: string
          unit_price: number
          unit_size: number
          updated_at?: string
          user_id: string
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
          purchase_date?: string | null
          recon_volume?: number | null
          reorder_quantity?: number
          timing_note?: string | null
          unit_label?: string
          unit_price?: number
          unit_size?: number
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
