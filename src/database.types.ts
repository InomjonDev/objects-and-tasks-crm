// Database contract for the committed migration. Regenerate with `supabase gen types typescript` after schema changes.
export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          display_name: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Insert: {
          id: string
          display_name: string
          role: Database["public"]["Enums"]["app_role"]
        }
        Update: {
          display_name?: string
          role?: Database["public"]["Enums"]["app_role"]
        }
        Relationships: []
      }
      projects: {
        Row: {
          id: string
          name: string
          address: string
          created_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          name: string
          address: string
          created_at?: string
          deleted_at?: string | null
        }
        Update: { name?: string; address?: string; deleted_at?: string | null }
        Relationships: []
      }
      tasks: {
        Row: {
          id: string
          title: string
          description: string
          project_id: string
          assignee_id: string
          status: Database["public"]["Enums"]["task_status"]
          author_id: string
          created_at: string
          deleted_at: string | null
        }
        Insert: {
          id?: string
          title: string
          description?: string
          project_id: string
          assignee_id: string
          status?: Database["public"]["Enums"]["task_status"]
          author_id: string
          created_at?: string
          deleted_at?: string | null
        }
        Update: {
          title?: string
          description?: string
          project_id?: string
          assignee_id?: string
          status?: Database["public"]["Enums"]["task_status"]
          deleted_at?: string | null
        }
        Relationships: []
      }
      task_history: {
        Row: {
          id: string
          task_id: string
          actor_id: string
          created_at: string
          from_status: Database["public"]["Enums"]["task_status"] | null
          to_status: Database["public"]["Enums"]["task_status"]
          comment: string | null
        }
        Insert: {
          task_id: string
          actor_id: string
          from_status?: Database["public"]["Enums"]["task_status"] | null
          to_status: Database["public"]["Enums"]["task_status"]
          comment?: string | null
        }
        Update: { comment?: string | null }
        Relationships: []
      }
    }
    Views: { [_ in never]: never }
    Functions: {
      save_project: {
        Args: { p_id: string | null; p_name: string; p_address: string }
        Returns: string
      }
      save_task: {
        Args: {
          p_id: string | null
          p_title: string
          p_description: string
          p_project_id: string
          p_assignee_id: string
        }
        Returns: string
      }
      delete_project: { Args: { p_id: string }; Returns: undefined }
      delete_task: { Args: { p_id: string }; Returns: undefined }
      transition_task: {
        Args: {
          p_task_id: string
          p_expected_status: Database["public"]["Enums"]["task_status"]
          p_next_status: Database["public"]["Enums"]["task_status"]
          p_comment?: string | null
        }
        Returns: undefined
      }
    }
    Enums: {
      app_role: "manager" | "executor"
      task_status:
        "new" | "in_progress" | "in_review" | "accepted" | "needs_revision"
    }
    CompositeTypes: { [_ in never]: never }
  }
}
