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
      chapter_reports: {
        Row: {
          chapter_number: number
          created_at: string
          id: string
          note: string
          reason: Database["public"]["Enums"]["report_reason"]
          reporter_id: string
          resolved_at: string | null
          status: Database["public"]["Enums"]["report_status"]
          story_id: string
        }
        Insert: {
          chapter_number: number
          created_at?: string
          id?: string
          note?: string
          reason: Database["public"]["Enums"]["report_reason"]
          reporter_id?: string
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          story_id: string
        }
        Update: {
          chapter_number?: number
          created_at?: string
          id?: string
          note?: string
          reason?: Database["public"]["Enums"]["report_reason"]
          reporter_id?: string
          resolved_at?: string | null
          status?: Database["public"]["Enums"]["report_status"]
          story_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "chapter_reports_reporter_id_fkey"
            columns: ["reporter_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chapter_reports_story_id_chapter_number_fkey"
            columns: ["story_id", "chapter_number"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["story_id", "number"]
          },
        ]
      }
      chapter_views: {
        Row: {
          chapter_number: number
          day: string
          story_id: string
          views: number
        }
        Insert: {
          chapter_number: number
          day: string
          story_id: string
          views?: number
        }
        Update: {
          chapter_number?: number
          day?: string
          story_id?: string
          views?: number
        }
        Relationships: [
          {
            foreignKeyName: "chapter_views_story_id_chapter_number_fkey"
            columns: ["story_id", "chapter_number"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["story_id", "number"]
          },
        ]
      }
      chapters: {
        Row: {
          content: string
          created_at: string
          id: string
          number: number
          published_at: string | null
          status: Database["public"]["Enums"]["publication_status"]
          story_id: string
          title: string
          updated_at: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          number: number
          published_at?: string | null
          status?: Database["public"]["Enums"]["publication_status"]
          story_id: string
          title?: string
          updated_at?: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          number?: number
          published_at?: string | null
          status?: Database["public"]["Enums"]["publication_status"]
          story_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "chapters_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chapters_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "story_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chapters_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "studio_stories"
            referencedColumns: ["id"]
          },
        ]
      }
      comments: {
        Row: {
          chapter_number: number | null
          content: string
          created_at: string
          id: string
          parent_id: string | null
          story_id: string
          user_id: string
        }
        Insert: {
          chapter_number?: number | null
          content: string
          created_at?: string
          id?: string
          parent_id?: string | null
          story_id: string
          user_id?: string
        }
        Update: {
          chapter_number?: number | null
          content?: string
          created_at?: string
          id?: string
          parent_id?: string | null
          story_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_story_id_chapter_number_fkey"
            columns: ["story_id", "chapter_number"]
            isOneToOne: false
            referencedRelation: "chapters"
            referencedColumns: ["story_id", "number"]
          },
          {
            foreignKeyName: "comments_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "story_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "studio_stories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_messages: {
        Row: {
          created_at: string
          email: string
          handled_at: string | null
          id: number
          ip_hash: string | null
          message: string
          name: string
          topic: Database["public"]["Enums"]["contact_topic"]
          user_id: string | null
        }
        Insert: {
          created_at?: string
          email: string
          handled_at?: string | null
          id?: never
          ip_hash?: string | null
          message: string
          name: string
          topic: Database["public"]["Enums"]["contact_topic"]
          user_id?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          handled_at?: string | null
          id?: never
          ip_hash?: string | null
          message?: string
          name?: string
          topic?: Database["public"]["Enums"]["contact_topic"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "contact_messages_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      curated_stories: {
        Row: {
          list: string
          position: number
          story_id: string
        }
        Insert: {
          list: string
          position?: number
          story_id: string
        }
        Update: {
          list?: string
          position?: number
          story_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "curated_stories_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curated_stories_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "story_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "curated_stories_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "studio_stories"
            referencedColumns: ["id"]
          },
        ]
      }
      follows: {
        Row: {
          followed_at: string
          seen_chapter: number
          story_id: string
          user_id: string
        }
        Insert: {
          followed_at?: string
          seen_chapter?: number
          story_id: string
          user_id?: string
        }
        Update: {
          followed_at?: string
          seen_chapter?: number
          story_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "follows_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "story_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "studio_stories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "follows_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      genres: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          name: string
          slug: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          name: string
          slug: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          name?: string
          slug?: string
        }
        Relationships: [
          {
            foreignKeyName: "genres_created_by_fkey"
            columns: ["created_by"]
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
          display_name: string
          id: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name: string
          id: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      ratings: {
        Row: {
          created_at: string
          score: number
          story_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          score: number
          story_id: string
          updated_at?: string
          user_id?: string
        }
        Update: {
          created_at?: string
          score?: number
          story_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "ratings_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "story_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "studio_stories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ratings_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      reading_history: {
        Row: {
          chapter_number: number
          chapter_title: string
          progress: number
          read_at: string
          story_id: string
          user_id: string
        }
        Insert: {
          chapter_number: number
          chapter_title?: string
          progress?: number
          read_at?: string
          story_id: string
          user_id?: string
        }
        Update: {
          chapter_number?: number
          chapter_title?: string
          progress?: number
          read_at?: string
          story_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reading_history_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reading_history_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "story_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reading_history_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "studio_stories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reading_history_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      stories: {
        Row: {
          author_name: string | null
          cover_path: string | null
          created_at: string
          description: string
          id: string
          owner_id: string
          published_at: string | null
          review_reason: string | null
          review_status: Database["public"]["Enums"]["review_status"] | null
          review_submitted_at: string | null
          reviewed_at: string | null
          search_title: string | null
          slug: string
          status: Database["public"]["Enums"]["story_status"]
          takedown_reason: string | null
          taken_down_at: string | null
          title: string
          updated_at: string
          visibility: Database["public"]["Enums"]["publication_status"]
        }
        Insert: {
          author_name?: string | null
          cover_path?: string | null
          created_at?: string
          description?: string
          id?: string
          owner_id?: string
          published_at?: string | null
          review_reason?: string | null
          review_status?: Database["public"]["Enums"]["review_status"] | null
          review_submitted_at?: string | null
          reviewed_at?: string | null
          search_title?: string | null
          slug: string
          status?: Database["public"]["Enums"]["story_status"]
          takedown_reason?: string | null
          taken_down_at?: string | null
          title: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["publication_status"]
        }
        Update: {
          author_name?: string | null
          cover_path?: string | null
          created_at?: string
          description?: string
          id?: string
          owner_id?: string
          published_at?: string | null
          review_reason?: string | null
          review_status?: Database["public"]["Enums"]["review_status"] | null
          review_submitted_at?: string | null
          reviewed_at?: string | null
          search_title?: string | null
          slug?: string
          status?: Database["public"]["Enums"]["story_status"]
          takedown_reason?: string | null
          taken_down_at?: string | null
          title?: string
          updated_at?: string
          visibility?: Database["public"]["Enums"]["publication_status"]
        }
        Relationships: [
          {
            foreignKeyName: "stories_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      story_genres: {
        Row: {
          genre_slug: string
          position: number
          story_id: string
        }
        Insert: {
          genre_slug: string
          position?: number
          story_id: string
        }
        Update: {
          genre_slug?: string
          position?: number
          story_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "story_genres_genre_slug_fkey"
            columns: ["genre_slug"]
            isOneToOne: false
            referencedRelation: "genre_cards"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "story_genres_genre_slug_fkey"
            columns: ["genre_slug"]
            isOneToOne: false
            referencedRelation: "genres"
            referencedColumns: ["slug"]
          },
          {
            foreignKeyName: "story_genres_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "story_genres_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "story_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "story_genres_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: false
            referencedRelation: "studio_stories"
            referencedColumns: ["id"]
          },
        ]
      }
      story_stats: {
        Row: {
          chapter_count: number
          first_chapter_number: number | null
          follower_count: number
          last_chapter_at: string | null
          latest_chapter_number: number | null
          latest_chapter_title: string | null
          rating_avg: number | null
          rating_count: number | null
          rating_counts: number[]
          rating_sum: number | null
          story_id: string
          view_count: number
        }
        Insert: {
          chapter_count?: number
          first_chapter_number?: number | null
          follower_count?: number
          last_chapter_at?: string | null
          latest_chapter_number?: number | null
          latest_chapter_title?: string | null
          rating_avg?: number | null
          rating_count?: number | null
          rating_counts?: number[]
          rating_sum?: number | null
          story_id: string
          view_count?: number
        }
        Update: {
          chapter_count?: number
          first_chapter_number?: number | null
          follower_count?: number
          last_chapter_at?: string | null
          latest_chapter_number?: number | null
          latest_chapter_title?: string | null
          rating_avg?: number | null
          rating_count?: number | null
          rating_counts?: number[]
          rating_sum?: number | null
          story_id?: string
          view_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "story_stats_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: true
            referencedRelation: "stories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "story_stats_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: true
            referencedRelation: "story_cards"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "story_stats_story_id_fkey"
            columns: ["story_id"]
            isOneToOne: true
            referencedRelation: "studio_stories"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      genre_cards: {
        Row: {
          created_at: string | null
          created_by: string | null
          created_by_name: string | null
          description: string | null
          name: string | null
          slug: string | null
          story_count: number | null
        }
        Relationships: [
          {
            foreignKeyName: "genres_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      story_cards: {
        Row: {
          author_key: string | null
          author_name: string | null
          chapter_count: number | null
          cover_path: string | null
          created_at: string | null
          description: string | null
          first_chapter_number: number | null
          follower_count: number | null
          genre_slugs: string[] | null
          genres: Json | null
          id: string | null
          latest_chapter_number: number | null
          latest_chapter_title: string | null
          owner_id: string | null
          rating_avg: number | null
          rating_count: number | null
          rating_counts: number[] | null
          slug: string | null
          status: Database["public"]["Enums"]["story_status"] | null
          title: string | null
          updated_at: string | null
          view_count: number | null
          visibility: Database["public"]["Enums"]["publication_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "stories_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      studio_stories: {
        Row: {
          author_name: string | null
          chapter_count: number | null
          cover_path: string | null
          created_at: string | null
          description: string | null
          draft_count: number | null
          followers: number | null
          genre_slugs: string[] | null
          id: string | null
          open_reports: number | null
          owner_id: string | null
          owner_name: string | null
          published_at: string | null
          published_count: number | null
          review_reason: string | null
          review_status: Database["public"]["Enums"]["review_status"] | null
          review_submitted_at: string | null
          reviewed_at: string | null
          slug: string | null
          status: Database["public"]["Enums"]["story_status"] | null
          takedown_reason: string | null
          taken_down_at: string | null
          title: string | null
          updated_at: string | null
          views: number | null
          visibility: Database["public"]["Enums"]["publication_status"] | null
        }
        Relationships: [
          {
            foreignKeyName: "stories_owner_id_fkey"
            columns: ["owner_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      admin_comments: {
        Args: { p_query?: string; p_reported?: boolean }
        Returns: {
          chapter_number: number
          content: string
          created_at: string
          id: string
          is_reply: boolean
          last_reported_at: string
          reply_count: number
          reports: Json
          story_slug: string
          story_title: string
          story_visibility: Database["public"]["Enums"]["publication_status"]
          user_id: string
          user_name: string
        }[]
      }
      admin_contact_messages: {
        Args: { p_query?: string; p_status?: string }
        Returns: {
          created_at: string
          email: string
          handled_at: string
          id: number
          message: string
          name: string
          topic: Database["public"]["Enums"]["contact_topic"]
          user_id: string
        }[]
      }
      admin_curated: {
        Args: { p_list: string }
        Returns: {
          author_name: string
          is_public: boolean
          slug: string
          story_id: string
          title: string
        }[]
      }
      admin_delete_comment: { Args: { p_id: string }; Returns: undefined }
      admin_delete_genre: { Args: { p_slug: string }; Returns: undefined }
      admin_dismiss_comment_reports: {
        Args: { p_comment_id: string }
        Returns: undefined
      }
      admin_merge_genres: {
        Args: { p_from: string; p_into: string }
        Returns: number
      }
      admin_overview: { Args: { p_days?: number }; Returns: Json }
      admin_reports: {
        Args: {
          p_query?: string
          p_status?: Database["public"]["Enums"]["report_status"]
        }
        Returns: {
          chapter_number: number
          chapter_title: string
          created_at: string
          id: string
          note: string
          reason: Database["public"]["Enums"]["report_reason"]
          reporter_id: string
          reporter_name: string
          resolved_at: string
          status: Database["public"]["Enums"]["report_status"]
          story_id: string
          story_slug: string
          story_title: string
          story_visibility: Database["public"]["Enums"]["publication_status"]
        }[]
      }
      admin_review_story: {
        Args: { p_approve: boolean; p_reason: string; p_story_id: string }
        Returns: undefined
      }
      admin_set_contact_handled: {
        Args: { p_handled: boolean; p_id: number }
        Returns: undefined
      }
      admin_set_curated: {
        Args: { p_list: string; p_story_ids: string[] }
        Returns: undefined
      }
      admin_set_report_status: {
        Args: {
          p_id: string
          p_status: Database["public"]["Enums"]["report_status"]
        }
        Returns: undefined
      }
      admin_set_story_takedown: {
        Args: { p_reason: string; p_story_id: string }
        Returns: undefined
      }
      admin_set_user_banned: {
        Args: { p_banned: boolean; p_user_id: string }
        Returns: undefined
      }
      admin_stories: {
        Args: {
          p_owner_id?: string
          p_query?: string
          p_sort?: string
          p_visibility?: Database["public"]["Enums"]["publication_status"]
        }
        Returns: {
          author_name: string
          chapter_count: number
          comment_count: number
          created_at: string
          follower_count: number
          genre_slugs: string[]
          id: string
          open_reports: number
          owner_id: string
          owner_name: string
          published_count: number
          rating_avg: number
          rating_count: number
          review_reason: string
          review_status: Database["public"]["Enums"]["review_status"]
          review_submitted_at: string
          reviewed_at: string
          slug: string
          status: Database["public"]["Enums"]["story_status"]
          takedown_reason: string
          taken_down_at: string
          title: string
          updated_at: string
          view_count: number
          visibility: Database["public"]["Enums"]["publication_status"]
        }[]
      }
      admin_update_genre: {
        Args: { p_description: string; p_name: string; p_slug: string }
        Returns: Json
      }
      admin_users: {
        Args: { p_query?: string }
        Returns: {
          avatar_url: string
          comment_count: number
          created_at: string
          display_name: string
          email: string
          follow_count: number
          id: string
          is_admin: boolean
          is_banned: boolean
          last_sign_in_at: string
          provider: string
          story_count: number
        }[]
      }
      comment_threads: {
        Args: { p_chapter?: number; p_story_id: string }
        Returns: {
          avatar_url: string
          chapter_number: number
          content: string
          created_at: string
          display_name: string
          id: string
          reply_count: number
          user_id: string
        }[]
      }
      create_story: {
        Args: {
          p_author_name?: string
          p_cover_path?: string
          p_description: string
          p_first_chapter?: Json
          p_genres: string[]
          p_publish?: boolean
          p_status: Database["public"]["Enums"]["story_status"]
          p_title: string
        }
        Returns: {
          author_name: string | null
          chapter_count: number | null
          cover_path: string | null
          created_at: string | null
          description: string | null
          draft_count: number | null
          followers: number | null
          genre_slugs: string[] | null
          id: string | null
          open_reports: number | null
          owner_id: string | null
          owner_name: string | null
          published_at: string | null
          published_count: number | null
          review_reason: string | null
          review_status: Database["public"]["Enums"]["review_status"] | null
          review_submitted_at: string | null
          reviewed_at: string | null
          slug: string | null
          status: Database["public"]["Enums"]["story_status"] | null
          takedown_reason: string | null
          taken_down_at: string | null
          title: string | null
          updated_at: string | null
          views: number | null
          visibility: Database["public"]["Enums"]["publication_status"] | null
        }[]
        SetofOptions: {
          from: "*"
          to: "studio_stories"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      delete_account: { Args: never; Returns: undefined }
      get_library: {
        Args: never
        Returns: {
          followed_at: string
          new_chapters: number
          seen_chapter: number
          slug: string
          story_id: string
        }[]
      }
      library_update_count: { Args: never; Returns: number }
      merge_guest_history: { Args: { p_entries: Json }; Returns: undefined }
      record_chapter_view: {
        Args: { p_number: number; p_slug: string }
        Returns: undefined
      }
      related_stories: {
        Args: { p_limit?: number; p_slug: string }
        Returns: {
          overlap: number
          story_id: string
        }[]
      }
      report_chapter: {
        Args: {
          p_chapter: number
          p_note?: string
          p_reason: Database["public"]["Enums"]["report_reason"]
          p_slug: string
        }
        Returns: {
          chapter_number: number
          created_at: string
          id: string
          note: string
          reason: Database["public"]["Enums"]["report_reason"]
          reporter_id: string
          resolved_at: string | null
          status: Database["public"]["Enums"]["report_status"]
          story_id: string
        }
        SetofOptions: {
          from: "*"
          to: "chapter_reports"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      report_comment: {
        Args: {
          p_comment_id: string
          p_note?: string
          p_reason: Database["public"]["Enums"]["comment_report_reason"]
        }
        Returns: undefined
      }
      save_reading_progress: {
        Args: {
          p_chapter: number
          p_chapter_title: string
          p_progress?: number
          p_slug: string
        }
        Returns: {
          chapter_number: number
          chapter_title: string
          progress: number
          read_at: string
          story_id: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "reading_history"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      search_stories: {
        Args: { p_query: string }
        Returns: {
          score: number
          story_id: string
          view_count: number
        }[]
      }
      slugify: { Args: { value: string }; Returns: string }
      story_ranking: {
        Args: { p_by?: string; p_limit?: number; p_period?: string }
        Returns: {
          story_id: string
          value: number
        }[]
      }
      studio_story_stats: { Args: { p_story_id: string }; Returns: Json }
      submit_story_for_review: {
        Args: { p_story_id: string }
        Returns: undefined
      }
      update_story: {
        Args: {
          p_author_name?: string
          p_cover_path?: string
          p_description: string
          p_genres: string[]
          p_id: string
          p_status: Database["public"]["Enums"]["story_status"]
          p_title: string
        }
        Returns: {
          author_name: string | null
          chapter_count: number | null
          cover_path: string | null
          created_at: string | null
          description: string | null
          draft_count: number | null
          followers: number | null
          genre_slugs: string[] | null
          id: string | null
          open_reports: number | null
          owner_id: string | null
          owner_name: string | null
          published_at: string | null
          published_count: number | null
          review_reason: string | null
          review_status: Database["public"]["Enums"]["review_status"] | null
          review_submitted_at: string | null
          reviewed_at: string | null
          slug: string | null
          status: Database["public"]["Enums"]["story_status"] | null
          takedown_reason: string | null
          taken_down_at: string | null
          title: string | null
          updated_at: string | null
          views: number | null
          visibility: Database["public"]["Enums"]["publication_status"] | null
        }[]
        SetofOptions: {
          from: "*"
          to: "studio_stories"
          isOneToOne: false
          isSetofReturn: true
        }
      }
    }
    Enums: {
      comment_report_reason: "spam" | "offensive" | "spoiler" | "other"
      contact_topic: "general" | "bug" | "copyright" | "partnership"
      publication_status: "draft" | "published"
      report_reason: "typo" | "missing" | "order" | "violation" | "other"
      report_status: "open" | "resolved"
      review_status: "pending" | "approved" | "rejected"
      story_status: "ongoing" | "completed"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      comment_report_reason: ["spam", "offensive", "spoiler", "other"],
      contact_topic: ["general", "bug", "copyright", "partnership"],
      publication_status: ["draft", "published"],
      report_reason: ["typo", "missing", "order", "violation", "other"],
      report_status: ["open", "resolved"],
      review_status: ["pending", "approved", "rejected"],
      story_status: ["ongoing", "completed"],
    },
  },
} as const
