-- Create videos table
CREATE TABLE public.videos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  channel_title TEXT NOT NULL,
  duration TEXT NOT NULL,
  thumbnail_url TEXT NOT NULL,
  video_id TEXT NOT NULL
);

-- Add RLS (Row Level Security) policies
ALTER TABLE public.videos ENABLE ROW LEVEL SECURITY;

-- Policy: Videos are viewable by everyone (for public profiles)
CREATE POLICY "Videos are viewable by everyone" 
  ON public.videos 
  FOR SELECT 
  USING (true);

-- Policy: Users can insert their own videos
CREATE POLICY "Users can insert their own videos" 
  ON public.videos 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can update their own videos
CREATE POLICY "Users can update their own videos" 
  ON public.videos 
  FOR UPDATE 
  USING (auth.uid() = user_id);

-- Policy: Users can delete their own videos
CREATE POLICY "Users can delete their own videos" 
  ON public.videos 
  FOR DELETE 
  USING (auth.uid() = user_id);
