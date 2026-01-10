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
    PostgrestVersion: "13.0.5"
  }
  public: {
    Tables: {
      availability: {
        Row: {
          available_dates: string[] | null
          blocked_dates: string[] | null
          creator_id: string
          id: string
          recurring_days: number[] | null
          updated_at: string
        }
        Insert: {
          available_dates?: string[] | null
          blocked_dates?: string[] | null
          creator_id: string
          id?: string
          recurring_days?: number[] | null
          updated_at?: string
        }
        Update: {
          available_dates?: string[] | null
          blocked_dates?: string[] | null
          creator_id?: string
          id?: string
          recurring_days?: number[] | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "availability_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: true
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "availability_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: true
            referencedRelation: "public_creator_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      collab_requests: {
        Row: {
          created_at: string
          creator_id: string
          id: string
          message: string | null
          requested_date: string | null
          requester_email: string
          requester_name: string
          requester_profile_image_url: string | null
          requester_substack_url: string | null
          status: string
        }
        Insert: {
          created_at?: string
          creator_id: string
          id?: string
          message?: string | null
          requested_date?: string | null
          requester_email: string
          requester_name: string
          requester_profile_image_url?: string | null
          requester_substack_url?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          creator_id?: string
          id?: string
          message?: string | null
          requested_date?: string | null
          requester_email?: string
          requester_name?: string
          requester_profile_image_url?: string | null
          requester_substack_url?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "collab_requests_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "collab_requests_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "public_creator_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      creators: {
        Row: {
          bio: string | null
          created_at: string
          email: string
          id: string
          name: string
          substack_url: string | null
          updated_at: string
          user_id: string
          username: string
          welcome_message: string | null
        }
        Insert: {
          bio?: string | null
          created_at?: string
          email: string
          id?: string
          name: string
          substack_url?: string | null
          updated_at?: string
          user_id: string
          username: string
          welcome_message?: string | null
        }
        Update: {
          bio?: string | null
          created_at?: string
          email?: string
          id?: string
          name?: string
          substack_url?: string | null
          updated_at?: string
          user_id?: string
          username?: string
          welcome_message?: string | null
        }
        Relationships: []
      }
    }
    Views: {
      public_creator_profiles: {
        Row: {
          bio: string | null
          created_at: string | null
          id: string | null
          name: string | null
          substack_url: string | null
          username: string | null
          welcome_message: string | null
        }
        Insert: {
          bio?: string | null
          created_at?: string | null
          id?: string | null
          name?: string | null
          substack_url?: string | null
          username?: string | null
          welcome_message?: string | null
        }
        Update: {
          bio?: string | null
          created_at?: string | null
          id?: string | null
          name?: string | null
          substack_url?: string | null
          username?: string | null
          welcome_message?: string | null
        }
        Relationships: []
      }
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
