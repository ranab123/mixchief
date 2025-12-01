export interface Video {
  id: string;
  created_at: string;
  user_id: string;
  title: string;
  channel_title: string;
  duration: string;
  duration_seconds: number | null;
  thumbnail_url: string;
  video_id: string;
}

export interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface Database {
  public: {
    Tables: {
      videos: {
        Row: Video;
        Insert: Omit<Video, 'id' | 'created_at'>;
        Update: Partial<Omit<Video, 'id' | 'created_at'>>;
      };
      profiles: {
        Row: Profile;
        Insert: Omit<Profile, 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Profile, 'created_at' | 'updated_at'>>;
      };
    };
    Functions: {
      check_username_available: {
        Args: { username_to_check: string };
        Returns: boolean;
      };
    };
  };
}
