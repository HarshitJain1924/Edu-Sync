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
      ai_generated_courses: {
        Row: {
          course_data: Json
          created_at: string
          difficulty: string | null
          duration: string | null
          id: string
          learning_goal: string | null
          status: string | null
          tags: string[] | null
          thumbnail_url: string | null
          title: string
          topic: string
          updated_at: string
          user_id: string
        }
        Insert: {
          course_data?: Json
          created_at?: string
          difficulty?: string | null
          duration?: string | null
          id?: string
          learning_goal?: string | null
          status?: string | null
          tags?: string[] | null
          thumbnail_url?: string | null
          title: string
          topic: string
          updated_at?: string
          user_id: string
        }
        Update: {
          course_data?: Json
          created_at?: string
          difficulty?: string | null
          duration?: string | null
          id?: string
          learning_goal?: string | null
          status?: string | null
          tags?: string[] | null
          thumbnail_url?: string | null
          title?: string
          topic?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ai_generated_courses_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      flashcard_sets: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          title: string
          topic: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          title: string
          topic: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          title?: string
          topic?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "flashcard_sets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      flashcards: {
        Row: {
          answer: string
          created_at: string
          id: string
          order_index: number
          question: string
          set_id: string
        }
        Insert: {
          answer: string
          created_at?: string
          id?: string
          order_index?: number
          question: string
          set_id: string
        }
        Update: {
          answer?: string
          created_at?: string
          id?: string
          order_index?: number
          question?: string
          set_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "flashcards_set_id_fkey"
            columns: ["set_id"]
            isOneToOne: false
            referencedRelation: "flashcard_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      learning_styles: {
        Row: {
          created_at: string
          id: string
          responses: Json | null
          style: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          responses?: Json | null
          style: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          responses?: Json | null
          style?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "learning_styles_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      placement_scores: {
        Row: {
          completed_at: string
          created_at: string
          id: string
          questions: Json | null
          score: number
          test_type: string
          topic: string | null
          total: number
          user_id: string
        }
        Insert: {
          completed_at?: string
          created_at?: string
          id?: string
          questions?: Json | null
          score?: number
          test_type?: string
          topic?: string | null
          total?: number
          user_id: string
        }
        Update: {
          completed_at?: string
          created_at?: string
          id?: string
          questions?: Json | null
          score?: number
          test_type?: string
          topic?: string | null
          total?: number
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "placement_scores_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          id: string
          updated_at: string
          username: string | null
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          id: string
          updated_at?: string
          username?: string | null
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          id?: string
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      quiz_questions: {
        Row: {
          correct_answer: string
          created_at: string
          id: string
          options: Json
          order_index: number
          question: string
          quiz_id: string
        }
        Insert: {
          correct_answer: string
          created_at?: string
          id?: string
          options: Json
          order_index?: number
          question: string
          quiz_id: string
        }
        Update: {
          correct_answer?: string
          created_at?: string
          id?: string
          options?: Json
          order_index?: number
          question?: string
          quiz_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_questions_quiz_id_fkey"
            columns: ["quiz_id"]
            isOneToOne: false
            referencedRelation: "quiz_sets"
            referencedColumns: ["id"]
          },
        ]
      }
      quiz_sets: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          title: string
          topic: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          title: string
          topic: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          title?: string
          topic?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "quiz_sets_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      room_messages: {
        Row: {
          created_at: string
          id: string
          message: string
          room_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: string
          room_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: string
          room_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_messages_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "study_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      room_participants: {
        Row: {
          camera_on: boolean | null
          hand_raised: boolean | null
          id: string
          is_online: boolean | null
          joined_at: string
          mic_on: boolean | null
          role: string | null
          room_id: string
          screen_sharing: boolean | null
          user_id: string
        }
        Insert: {
          camera_on?: boolean | null
          hand_raised?: boolean | null
          id?: string
          is_online?: boolean | null
          joined_at?: string
          mic_on?: boolean | null
          role?: string | null
          room_id: string
          screen_sharing?: boolean | null
          user_id: string
        }
        Update: {
          camera_on?: boolean | null
          hand_raised?: boolean | null
          id?: string
          is_online?: boolean | null
          joined_at?: string
          mic_on?: boolean | null
          role?: string | null
          room_id?: string
          screen_sharing?: boolean | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_participants_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "study_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_participants_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      room_whiteboard_events: {
        Row: {
          created_at: string
          id: string
          points: Json
          room_id: string
          stroke: string | null
          stroke_width: number | null
          tool: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          points?: Json
          room_id: string
          stroke?: string | null
          stroke_width?: number | null
          tool?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          points?: Json
          room_id?: string
          stroke?: string | null
          stroke_width?: number | null
          tool?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "room_whiteboard_events_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "study_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "room_whiteboard_events_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      session_materials: {
        Row: {
          created_at: string
          file_url: string
          id: string
          room_id: string
          title: string
          uploaded_by: string
        }
        Insert: {
          created_at?: string
          file_url: string
          id?: string
          room_id: string
          title: string
          uploaded_by: string
        }
        Update: {
          created_at?: string
          file_url?: string
          id?: string
          room_id?: string
          title?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_materials_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "study_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_materials_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      study_rooms: {
        Row: {
          allow_student_drawing: boolean | null
          created_at: string
          created_by: string
          description: string | null
          host_id: string | null
          id: string
          is_active: boolean | null
          is_public: boolean | null
          max_participants: number | null
          name: string
          room_code: string | null
          topic: string | null
          updated_at: string
        }
        Insert: {
          allow_student_drawing?: boolean | null
          created_at?: string
          created_by: string
          description?: string | null
          host_id?: string | null
          id?: string
          is_active?: boolean | null
          is_public?: boolean | null
          max_participants?: number | null
          name: string
          room_code?: string | null
          topic?: string | null
          updated_at?: string
        }
        Update: {
          allow_student_drawing?: boolean | null
          created_at?: string
          created_by?: string
          description?: string | null
          host_id?: string | null
          id?: string
          is_active?: boolean | null
          is_public?: boolean | null
          max_participants?: number | null
          name?: string
          room_code?: string | null
          topic?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_rooms_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      study_sessions: {
        Row: {
          created_at: string
          end_time: string | null
          id: string
          room_id: string | null
          start_time: string
          status: string | null
          teacher_id: string
          title: string
        }
        Insert: {
          created_at?: string
          end_time?: string | null
          id?: string
          room_id?: string | null
          start_time?: string
          status?: string | null
          teacher_id: string
          title: string
        }
        Update: {
          created_at?: string
          end_time?: string | null
          id?: string
          room_id?: string | null
          start_time?: string
          status?: string | null
          teacher_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "study_sessions_room_id_fkey"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "study_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "study_sessions_teacher_id_fkey"
            columns: ["teacher_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      user_progress: {
        Row: {
          content_id: string
          content_type: string
          created_at: string
          id: string
          progress_data: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          content_id: string
          content_type: string
          created_at?: string
          id?: string
          progress_data?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          content_id?: string
          content_type?: string
          created_at?: string
          id?: string
          progress_data?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "user_progress_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
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
      video_interactions: {
        Row: {
          created_at: string
          id: string
          liked: boolean | null
          rating: number | null
          saved: boolean | null
          updated_at: string
          user_id: string
          video_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          liked?: boolean | null
          rating?: number | null
          saved?: boolean | null
          updated_at?: string
          user_id: string
          video_id: string
        }
        Update: {
          created_at?: string
          id?: string
          liked?: boolean | null
          rating?: number | null
          saved?: boolean | null
          updated_at?: string
          user_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_interactions_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      video_notes: {
        Row: {
          created_at: string
          id: string
          is_bookmark: boolean | null
          note_text: string
          timestamp_seconds: number
          updated_at: string
          user_id: string
          video_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_bookmark?: boolean | null
          note_text: string
          timestamp_seconds: number
          updated_at?: string
          user_id: string
          video_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_bookmark?: boolean | null
          note_text?: string
          timestamp_seconds?: number
          updated_at?: string
          user_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_notes_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      video_progress: {
        Row: {
          completed: boolean | null
          created_at: string
          id: string
          last_watched_at: string | null
          progress_seconds: number | null
          updated_at: string
          user_id: string
          video_id: string
        }
        Insert: {
          completed?: boolean | null
          created_at?: string
          id?: string
          last_watched_at?: string | null
          progress_seconds?: number | null
          updated_at?: string
          user_id: string
          video_id: string
        }
        Update: {
          completed?: boolean | null
          created_at?: string
          id?: string
          last_watched_at?: string | null
          progress_seconds?: number | null
          updated_at?: string
          user_id?: string
          video_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "video_progress_video_id_fkey"
            columns: ["video_id"]
            isOneToOne: false
            referencedRelation: "videos"
            referencedColumns: ["id"]
          },
        ]
      }
      videos: {
        Row: {
          created_at: string
          description: string | null
          difficulty: string | null
          duration: number
          id: string
          likes_count: number | null
          tags: string[] | null
          thumbnail_url: string | null
          title: string
          topic: string | null
          updated_at: string
          url: string
          views_count: number | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          difficulty?: string | null
          duration: number
          id?: string
          likes_count?: number | null
          tags?: string[] | null
          thumbnail_url?: string | null
          title: string
          topic?: string | null
          updated_at?: string
          url: string
          views_count?: number | null
        }
        Update: {
          created_at?: string
          description?: string | null
          difficulty?: string | null
          duration?: number
          id?: string
          likes_count?: number | null
          tags?: string[] | null
          thumbnail_url?: string | null
          title?: string
          topic?: string | null
          updated_at?: string
          url?: string
          views_count?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "student" | "teacher" | "admin"
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
      app_role: ["student", "teacher", "admin"],
    },
  },
} as const
