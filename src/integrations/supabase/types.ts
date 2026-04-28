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
      analytics_events: {
        Row: {
          created_at: string | null
          event_data: Json | null
          event_type: string
          id: string
          page_url: string | null
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          event_data?: Json | null
          event_type: string
          id?: string
          page_url?: string | null
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          event_data?: Json | null
          event_type?: string
          id?: string
          page_url?: string | null
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
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
      collab_metrics: {
        Row: {
          created_at: string
          creator_comments: number | null
          creator_likes: number | null
          creator_post_url: string | null
          creator_subscribers: number | null
          id: string
          request_id: string
          requester_comments: number | null
          requester_likes: number | null
          requester_post_url: string | null
          requester_subscribers: number | null
          snapshot_at: string
          snapshot_day: number
        }
        Insert: {
          created_at?: string
          creator_comments?: number | null
          creator_likes?: number | null
          creator_post_url?: string | null
          creator_subscribers?: number | null
          id?: string
          request_id: string
          requester_comments?: number | null
          requester_likes?: number | null
          requester_post_url?: string | null
          requester_subscribers?: number | null
          snapshot_at?: string
          snapshot_day?: number
        }
        Update: {
          created_at?: string
          creator_comments?: number | null
          creator_likes?: number | null
          creator_post_url?: string | null
          creator_subscribers?: number | null
          id?: string
          request_id?: string
          requester_comments?: number | null
          requester_likes?: number | null
          requester_post_url?: string | null
          requester_subscribers?: number | null
          snapshot_at?: string
          snapshot_day?: number
        }
        Relationships: [
          {
            foreignKeyName: "collab_metrics_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "collab_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      collab_requests: {
        Row: {
          ai_draft: Json | null
          ai_suggestion_used: Json | null
          approved_at: string | null
          collab_link: string | null
          content_last_edited_at: string | null
          content_last_edited_by: string | null
          created_at: string
          creator_id: string
          creator_notes: string | null
          editing_sessions: Json | null
          first_draft_generated_at: string | null
          hidden_by_creator: boolean
          hidden_by_requester: boolean
          id: string
          is_solo: boolean
          message: string | null
          reminder_sent_at: string | null
          requested_date: string | null
          requester_collab_link: string | null
          requester_email: string
          requester_name: string
          requester_profile_image_url: string | null
          requester_substack_url: string | null
          requester_user_id: string | null
          retro_completed_at: string | null
          retro_notes: string | null
          retro_rating: number | null
          selected_collab_type: string | null
          shared_content: string | null
          status: string
          view_token: string
        }
        Insert: {
          ai_draft?: Json | null
          ai_suggestion_used?: Json | null
          approved_at?: string | null
          collab_link?: string | null
          content_last_edited_at?: string | null
          content_last_edited_by?: string | null
          created_at?: string
          creator_id: string
          creator_notes?: string | null
          editing_sessions?: Json | null
          first_draft_generated_at?: string | null
          hidden_by_creator?: boolean
          hidden_by_requester?: boolean
          id?: string
          is_solo?: boolean
          message?: string | null
          reminder_sent_at?: string | null
          requested_date?: string | null
          requester_collab_link?: string | null
          requester_email: string
          requester_name: string
          requester_profile_image_url?: string | null
          requester_substack_url?: string | null
          requester_user_id?: string | null
          retro_completed_at?: string | null
          retro_notes?: string | null
          retro_rating?: number | null
          selected_collab_type?: string | null
          shared_content?: string | null
          status?: string
          view_token?: string
        }
        Update: {
          ai_draft?: Json | null
          ai_suggestion_used?: Json | null
          approved_at?: string | null
          collab_link?: string | null
          content_last_edited_at?: string | null
          content_last_edited_by?: string | null
          created_at?: string
          creator_id?: string
          creator_notes?: string | null
          editing_sessions?: Json | null
          first_draft_generated_at?: string | null
          hidden_by_creator?: boolean
          hidden_by_requester?: boolean
          id?: string
          is_solo?: boolean
          message?: string | null
          reminder_sent_at?: string | null
          requested_date?: string | null
          requester_collab_link?: string | null
          requester_email?: string
          requester_name?: string
          requester_profile_image_url?: string | null
          requester_substack_url?: string | null
          requester_user_id?: string | null
          retro_completed_at?: string | null
          retro_notes?: string | null
          retro_rating?: number | null
          selected_collab_type?: string | null
          shared_content?: string | null
          status?: string
          view_token?: string
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
      collaboration_messages: {
        Row: {
          content: string
          created_at: string | null
          id: string
          request_id: string
          sender_email: string
          sender_type: string
        }
        Insert: {
          content: string
          created_at?: string | null
          id?: string
          request_id: string
          sender_email: string
          sender_type: string
        }
        Update: {
          content?: string
          created_at?: string | null
          id?: string
          request_id?: string
          sender_email?: string
          sender_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "collaboration_messages_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "collab_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_contacts: {
        Row: {
          created_at: string
          creator_id: string
          email: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          creator_id: string
          email: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          creator_id?: string
          email?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_contacts_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: true
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_contacts_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: true
            referencedRelation: "public_creator_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_recommendations: {
        Row: {
          creator_id: string
          fetched_at: string
          id: string
          publication_id: string
        }
        Insert: {
          creator_id: string
          fetched_at?: string
          id?: string
          publication_id: string
        }
        Update: {
          creator_id?: string
          fetched_at?: string
          id?: string
          publication_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "creator_recommendations_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_recommendations_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: false
            referencedRelation: "public_creator_profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_recommendations_publication_id_fkey"
            columns: ["publication_id"]
            isOneToOne: false
            referencedRelation: "discovered_publications"
            referencedColumns: ["id"]
          },
        ]
      }
      creator_writing_samples: {
        Row: {
          creator_id: string
          id: string
          sample_posts: Json | null
          tone_profile: Json | null
          updated_at: string | null
        }
        Insert: {
          creator_id: string
          id?: string
          sample_posts?: Json | null
          tone_profile?: Json | null
          updated_at?: string | null
        }
        Update: {
          creator_id?: string
          id?: string
          sample_posts?: Json | null
          tone_profile?: Json | null
          updated_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "creator_writing_samples_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: true
            referencedRelation: "creators"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "creator_writing_samples_creator_id_fkey"
            columns: ["creator_id"]
            isOneToOne: true
            referencedRelation: "public_creator_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      creators: {
        Row: {
          bio: string | null
          collab_formats: string | null
          collab_guidelines: string | null
          collab_mode: string | null
          collab_style: string | null
          collab_vibe: string | null
          created_at: string
          credits: number
          date_meaning: string | null
          id: string
          join_directory_waitlist: boolean | null
          name: string
          newsletter_url: string | null
          profile_image_url: string | null
          profile_theme: Json | null
          referred_by: string | null
          reminder_days_before: number | null
          stripe_customer_id: string | null
          stripe_subscription_id: string | null
          subscription_tier: string | null
          substack_url: string | null
          trial_ends_at: string | null
          updated_at: string
          user_id: string
          username: string
          welcome_message: string | null
        }
        Insert: {
          bio?: string | null
          collab_formats?: string | null
          collab_guidelines?: string | null
          collab_mode?: string | null
          collab_style?: string | null
          collab_vibe?: string | null
          created_at?: string
          credits?: number
          date_meaning?: string | null
          id?: string
          join_directory_waitlist?: boolean | null
          name: string
          newsletter_url?: string | null
          profile_image_url?: string | null
          profile_theme?: Json | null
          referred_by?: string | null
          reminder_days_before?: number | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_tier?: string | null
          substack_url?: string | null
          trial_ends_at?: string | null
          updated_at?: string
          user_id: string
          username: string
          welcome_message?: string | null
        }
        Update: {
          bio?: string | null
          collab_formats?: string | null
          collab_guidelines?: string | null
          collab_mode?: string | null
          collab_style?: string | null
          collab_vibe?: string | null
          created_at?: string
          credits?: number
          date_meaning?: string | null
          id?: string
          join_directory_waitlist?: boolean | null
          name?: string
          newsletter_url?: string | null
          profile_image_url?: string | null
          profile_theme?: Json | null
          referred_by?: string | null
          reminder_days_before?: number | null
          stripe_customer_id?: string | null
          stripe_subscription_id?: string | null
          subscription_tier?: string | null
          substack_url?: string | null
          trial_ends_at?: string | null
          updated_at?: string
          user_id?: string
          username?: string
          welcome_message?: string | null
        }
        Relationships: []
      }
      discovered_publications: {
        Row: {
          author_name: string | null
          description: string | null
          discovered_at: string
          id: string
          language: string | null
          logo_url: string | null
          name: string | null
          subdomain: string
          subscriber_count: number | null
        }
        Insert: {
          author_name?: string | null
          description?: string | null
          discovered_at?: string
          id?: string
          language?: string | null
          logo_url?: string | null
          name?: string | null
          subdomain: string
          subscriber_count?: number | null
        }
        Update: {
          author_name?: string | null
          description?: string | null
          discovered_at?: string
          id?: string
          language?: string | null
          logo_url?: string | null
          name?: string | null
          subdomain?: string
          subscriber_count?: number | null
        }
        Relationships: []
      }
      email_events: {
        Row: {
          created_at: string
          id: string
          provider_id: string | null
          request_id: string
          status: string
          to_email: string
          type: string
        }
        Insert: {
          created_at?: string
          id?: string
          provider_id?: string | null
          request_id: string
          status?: string
          to_email: string
          type: string
        }
        Update: {
          created_at?: string
          id?: string
          provider_id?: string | null
          request_id?: string
          status?: string
          to_email?: string
          type?: string
        }
        Relationships: []
      }
      fulfilled_stripe_sessions: {
        Row: {
          credits_added: number
          fulfilled_at: string
          stripe_session_id: string
          user_id: string
        }
        Insert: {
          credits_added: number
          fulfilled_at?: string
          stripe_session_id: string
          user_id: string
        }
        Update: {
          credits_added?: number
          fulfilled_at?: string
          stripe_session_id?: string
          user_id?: string
        }
        Relationships: []
      }
      referral_credits: {
        Row: {
          created_at: string
          id: string
          referred_user_id: string
          referrer_user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          referred_user_id: string
          referrer_user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          referred_user_id?: string
          referrer_user_id?: string
        }
        Relationships: []
      }
      user_feedback: {
        Row: {
          created_at: string | null
          email: string | null
          feedback_type: string
          id: string
          message: string
          page_url: string | null
          rating: number | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          email?: string | null
          feedback_type: string
          id?: string
          message: string
          page_url?: string | null
          rating?: number | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          email?: string | null
          feedback_type?: string
          id?: string
          message?: string
          page_url?: string | null
          rating?: number | null
          user_id?: string | null
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string | null
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string | null
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      workspace_collaborators: {
        Row: {
          email: string
          id: string
          invited_at: string
          invited_by: string
          joined_at: string | null
          request_id: string
          role: string
          user_id: string | null
        }
        Insert: {
          email: string
          id?: string
          invited_at?: string
          invited_by: string
          joined_at?: string | null
          request_id: string
          role?: string
          user_id?: string | null
        }
        Update: {
          email?: string
          id?: string
          invited_at?: string
          invited_by?: string
          joined_at?: string | null
          request_id?: string
          role?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "workspace_collaborators_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "collab_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_presence: {
        Row: {
          has_unsaved: boolean
          id: string
          last_active_at: string
          request_id: string
          user_id: string
          user_name: string
        }
        Insert: {
          has_unsaved?: boolean
          id?: string
          last_active_at?: string
          request_id: string
          user_id: string
          user_name: string
        }
        Update: {
          has_unsaved?: boolean
          id?: string
          last_active_at?: string
          request_id?: string
          user_id?: string
          user_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_presence_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "collab_requests"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      public_booked_dates: {
        Row: {
          creator_id: string | null
          requested_date: string | null
          status: string | null
        }
        Insert: {
          creator_id?: string | null
          requested_date?: string | null
          status?: string | null
        }
        Update: {
          creator_id?: string | null
          requested_date?: string | null
          status?: string | null
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
      public_creator_profiles: {
        Row: {
          bio: string | null
          collab_formats: string | null
          collab_guidelines: string | null
          collab_mode: string | null
          collab_style: string | null
          collab_vibe: string | null
          created_at: string | null
          date_meaning: string | null
          id: string | null
          name: string | null
          newsletter_url: string | null
          profile_image_url: string | null
          profile_theme: Json | null
          substack_url: string | null
          username: string | null
          welcome_message: string | null
        }
        Insert: {
          bio?: string | null
          collab_formats?: string | null
          collab_guidelines?: string | null
          collab_mode?: string | null
          collab_style?: string | null
          collab_vibe?: string | null
          created_at?: string | null
          date_meaning?: string | null
          id?: string | null
          name?: string | null
          newsletter_url?: string | null
          profile_image_url?: string | null
          profile_theme?: Json | null
          substack_url?: string | null
          username?: string | null
          welcome_message?: string | null
        }
        Update: {
          bio?: string | null
          collab_formats?: string | null
          collab_guidelines?: string | null
          collab_mode?: string | null
          collab_style?: string | null
          collab_vibe?: string | null
          created_at?: string | null
          date_meaning?: string | null
          id?: string | null
          name?: string | null
          newsletter_url?: string | null
          profile_image_url?: string | null
          profile_theme?: Json | null
          substack_url?: string | null
          username?: string | null
          welcome_message?: string | null
        }
        Relationships: []
      }
    }
    Functions: {
      get_host_capacity: { Args: { _creator_id: string }; Returns: Json }
      get_public_sheet: {
        Args: { _token: string }
        Returns: {
          creator_name: string
          creator_username: string
          project_title: string
          request_id: string
          shared_content: string
        }[]
      }
      get_user_id_by_username: { Args: { _username: string }; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      has_workspace_access: {
        Args: { _request_id: string; _user_id: string }
        Returns: boolean
      }
      is_collab_participant: { Args: { _user_id: string }; Returns: boolean }
      is_pro_user: { Args: { _user_id: string }; Returns: boolean }
      is_request_owner: {
        Args: { _request_id: string; _user_id: string }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin" | "user" | "pro"
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
      app_role: ["admin", "user", "pro"],
    },
  },
} as const
