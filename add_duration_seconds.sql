-- Add duration_seconds column to videos table
ALTER TABLE public.videos 
ADD COLUMN duration_seconds INTEGER;

-- Add index for faster queries when calculating totals
CREATE INDEX idx_videos_user_id ON public.videos(user_id);
CREATE INDEX idx_videos_video_id ON public.videos(video_id);

