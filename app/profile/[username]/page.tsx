"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";
import ProfileExperience from "@/app/components/ProfileExperience";
import type { VinylStackItem } from "@/app/components/VinylStack3D";
import { useVinylPlayer } from "@/hooks/useVinylPlayer";
import { buildProfileUrl } from "@/lib/url";

interface Profile {
  id: string;
  username: string;
  display_name: string | null;
}

interface VideoRow {
  id: string;
  title: string;
  channel_title: string;
  duration: string;
  thumbnail_url: string;
  video_id: string;
  created_at: string;
  user_id: string;
}

export default function PublicProfilePage() {
  const params = useParams();
  const username = params.username as string;
  const router = useRouter();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [videos, setVideos] = useState<VideoRow[]>([]);
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [shareCopied, setShareCopied] = useState(false);
  const shareCopiedTimeoutRef = useRef<number | null>(null);

  const {
    activeVideoId,
    isPlaying,
    currentTime,
    clearSelectionKey,
    activeLabelSrc,
    playOrToggle,
    handleSeek,
    stop,
    setClearSelectionKey,
  } = useVinylPlayer();

  useEffect(() => {
    async function loadProfileData() {
      try {
        setLoading(true);
        setError(null);

        const { data: profileData, error: profileError } = (await supabase
          .from("profiles")
          .select("id, username, display_name")
          .eq("username", username)
          .single()) as {
          data: Profile | null;
          error: any;
        };

        if (profileError || !profileData) {
          setError("Profile not found");
          setLoading(false);
          return;
        }

        setProfile(profileData);

        const { data: videosData, error: videosError } = (await supabase
          .from("videos")
          .select("*")
          .eq("user_id", profileData.id)
          .order("created_at", { ascending: false })) as {
          data: VideoRow[] | null;
          error: any;
        };

        if (videosError) {
          console.error("[PublicProfile] Error loading videos:", videosError);
          setVideos([]);
        } else {
          console.log(
            "[PublicProfile] Loaded videos for profile",
            profileData.username,
            "count=",
            videosData?.length ?? 0
          );
          setVideos(videosData || []);
        }

        const {
          data: { user },
        } = await supabase.auth.getUser();
        const own = user?.id === profileData.id;
        console.log(
          "[PublicProfile] isOwnProfile?",
          own,
          "viewerId=",
          user?.id,
          "profileId=",
          profileData.id
        );
        setIsOwnProfile(own);
      } catch (err) {
        console.error("[PublicProfile] Error loading profile:", err);
        setError("Error loading profile");
      } finally {
        setLoading(false);
      }
    }

    loadProfileData();
  }, [username]);

  useEffect(() => {
    return () => {
      if (shareCopiedTimeoutRef.current) {
        window.clearTimeout(shareCopiedTimeoutRef.current);
        shareCopiedTimeoutRef.current = null;
      }
    };
  }, []);

  function copyProfileUrl() {
    if (!profile || typeof window === "undefined") return;
    const url = buildProfileUrl(profile.username);
    navigator.clipboard.writeText(url);
    setShareCopied(true);
    if (shareCopiedTimeoutRef.current) {
      window.clearTimeout(shareCopiedTimeoutRef.current);
    }
    shareCopiedTimeoutRef.current = window.setTimeout(() => {
      setShareCopied(false);
      shareCopiedTimeoutRef.current = null;
    }, 1000);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    router.push("/");
  }

  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4 flex flex-col items-center justify-center min-h-screen">
        <div className="w-16 h-16 border-4 border-black border-t-transparent rounded-full animate-spin" />
        <p className="mt-4 text-gray-600">Loading profile...</p>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="container mx-auto py-8 px-4">
        <button
          type="button"
          onClick={() => router.push("/")}
          className="text-blue-600 hover:underline mb-4 inline-block"
        >
          ← Back to Home
        </button>
        <div className="mt-8 text-center">
          <h2 className="text-2xl font-bold text-red-500">Profile Not Found</h2>
          <p className="mt-2 text-gray-600">
            The profile you're looking for doesn't exist or has been removed.
          </p>
        </div>
      </div>
    );
  }

  const vinylItems: VinylStackItem[] = videos.map((video) => ({
    src: video.thumbnail_url,
    videoId: video.video_id,
    id: video.id,
    title: video.title,
    channelTitle: video.channel_title,
    created_at: video.created_at,
    duration: video.duration,
  }));

  console.log("[PublicProfile] Rendering with:", {
    username: profile.username,
    videoCount: videos.length,
    vinylItemsCount: vinylItems.length,
    isOwnProfile,
    hasVideos: vinylItems.length > 0,
    firstVideo: vinylItems[0]
  });

  function triggerPlayback(videoId: string, fadeIn: boolean) {
    const match = vinylItems.find((item) => item.videoId === videoId);
    playOrToggle(videoId, fadeIn, match?.src);
  }

  const handlePlayRequest = (videoId: string) => triggerPlayback(videoId, true);
  const handleToggleRequest = (videoId: string) => triggerPlayback(videoId, false);
  
  function handleCloseActive() {
    // Stop the YouTube player and clear active video
    stop();
    // Clear vinyl selection in VinylStack3D
    setClearSelectionKey((k) => k + 1);
  }

  async function handleDelete(item: VinylStackItem) {
    if (!item.id) return;
    try {
      const { error } = await supabase.from("videos").delete().eq("id", item.id);
      if (error) {
        console.error("[PublicProfile] Error deleting video:", error);
        alert("Failed to delete mix. Please try again.");
        return;
      }
      // Remove from local state
      setVideos((prev) => prev.filter((v) => v.id !== item.id));
    } catch (err) {
      console.error("[PublicProfile] Error deleting video:", err);
      alert("Failed to delete mix. Please try again.");
    }
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-screen py-8 relative">
      {vinylItems.length === 0 && (
        <div className="fixed top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-50 bg-white/90 p-4 rounded-lg shadow-lg">
          <p className="text-sm text-gray-600">
            {profile.username} hasn't added any mixes yet.
          </p>
        </div>
      )}
      <ProfileExperience
        shareCopied={shareCopied}
        onCopyProfileUrl={copyProfileUrl}
        onSignOut={isOwnProfile ? handleSignOut : undefined}
        showOwnerActions={isOwnProfile}
        videos={vinylItems}
        isPlaying={isPlaying}
        currentTime={currentTime}
        clearSelectionKey={clearSelectionKey}
        onRequestPlay={handlePlayRequest}
        onRequestToggle={handleToggleRequest}
        onSeek={handleSeek}
        onDelete={isOwnProfile ? handleDelete : undefined}
        activeVideoId={activeVideoId}
        onHomeClick={() => router.push("/")}
        onCloseActive={handleCloseActive}
        showAddControl={false}
      />
    </main>
  );
}
