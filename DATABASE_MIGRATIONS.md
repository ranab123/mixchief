# Database Migrations

This document explains the SQL migration files and how to apply them to your Supabase database.

## Migration Files

### 1. `add_duration_seconds.sql`
Adds a `duration_seconds` column to the `videos` table for accurate duration tracking and calculations.

**Run this first** if you're updating an existing database.

```sql
-- Add duration_seconds column to videos table
ALTER TABLE public.videos 
ADD COLUMN duration_seconds INTEGER;

-- Add indexes for faster queries
CREATE INDEX idx_videos_user_id ON public.videos(user_id);
CREATE INDEX idx_videos_video_id ON public.videos(video_id);
```

### 2. `backfill_duration_seconds.sql`
Backfills the `duration_seconds` column for existing videos by parsing the human-readable duration strings (e.g., "1h 30m 45s").

**Run this after** `add_duration_seconds.sql` to update existing video records.

## How to Apply Migrations

### Option 1: Supabase Dashboard (Recommended)
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor** in the left sidebar
3. Create a new query
4. Copy the contents of `add_duration_seconds.sql`
5. Click **Run** to execute
6. Repeat steps 3-5 for `backfill_duration_seconds.sql`

### Option 2: Supabase CLI
```bash
# Make sure you're logged in
supabase login

# Link to your project
supabase link --project-ref your-project-ref

# Run the migrations
supabase db push add_duration_seconds.sql
supabase db push backfill_duration_seconds.sql
```

## What Changed

### Database Schema
- Added `duration_seconds` INTEGER column to `videos` table
- Added indexes on `user_id` and `video_id` for better query performance

### Application Code
- YouTube API now returns `durationSeconds` in addition to human-readable duration
- Videos are saved with `duration_seconds` for accurate calculations
- Profile pages now accurately calculate total duration from `duration_seconds`
- "Mixes in Common" feature compares `video_id` between users

## Features Enabled

### 1. Accurate Total Duration
The app now accurately calculates the total duration of all tracks by summing the `duration_seconds` values, then converting to hours.

### 2. Mixes in Common
When viewing another user's profile, the app compares their videos with yours (if logged in) and displays how many mixes you have in common.

## Testing

After running the migrations:
1. Add a new YouTube video to your library
2. Check that `duration_seconds` is populated in the database
3. View another user's profile to see the accurate total duration
4. If logged in, verify that "Mixes in Common" displays the correct count


