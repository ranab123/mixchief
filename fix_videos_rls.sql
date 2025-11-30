-- Fix RLS policy to allow public viewing of videos
-- This allows anyone (even unauthenticated users) to view videos

-- First, drop the restrictive policy
DROP POLICY IF EXISTS "Users can view their own videos" ON public.videos;

-- Create a new policy that allows everyone to view all videos
CREATE POLICY "Videos are viewable by everyone" 
  ON public.videos 
  FOR SELECT 
  USING (true);

-- Keep the existing policies for insert/update/delete (only owners can modify)
-- These should already exist from your create_videos_table.sql:
-- - "Users can insert their own videos"
-- - "Users can update their own videos"
-- - "Users can delete their own videos"



