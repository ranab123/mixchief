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
  const [showInput, setShowInput] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const [savingVideo, setSavingVideo] = useState(false);

  const [shareCopied, setShareCopied] = useState(false);
  const shareCopiedTimeoutRef = useRef<number | null>(null);
  const addControlRef = useRef<HTMLDivElement | null>(null);

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

  // Close add-input when clicking outside of the plus/control
  useEffect(() => {
    if (!showInput) return;

    function handleDocumentClick(event: MouseEvent) {
      if (!addControlRef.current) return;
      const target = event.target as Node | null;
      if (target && !addControlRef.current.contains(target)) {
        setShowInput(false);
      }
    }

    document.addEventListener('mousedown', handleDocumentClick);
    return () => {
      document.removeEventListener('mousedown', handleDocumentClick);
    };
  }, [showInput]);

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

  function toggleInput() {
    setShowInput(!showInput);
    setInputError(null);
  }

  function handleInputChange(value: string) {
    setInputValue(value);
    if (inputError) {
      setInputError(null);
    }
  }

  function extractYouTubeVideoId(url: string): string | null {
    // Regular expressions to match various YouTube URL formats
    const regexPatterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/user\/.+\/\w{11}|youtube\.com\/\w{11})([^&?\n]+)/,
      /youtube\.com\/watch\?.*v=([^&]+)/,
      /youtu\.be\/([^?&]+)/,
      /youtube\.com\/embed\/([^?&]+)/
    ];
    
    for (const pattern of regexPatterns) {
      const match = url.match(pattern);
      if (match && match[1]) {
        return match[1];
      }
    }
    
    return null;
  }

  async function fetchYouTubeData(videoId: string) {
    try {
      setSavingVideo(true);
      setInputError(null);
      
      // Use our server-side API route to protect the API key
      const response = await fetch(`/api/youtube?videoId=${videoId}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch video data');
      }
      
      const videoData = await response.json();
      
      if (profile) {
        await saveVideoToSupabase(videoData);
      }
      
      setSavingVideo(false);
      setInputValue(''); // Clear input after successful submission
      setShowInput(false); // Hide input after successful submission
    } catch (error: any) {
      setInputError(error.message || "Failed to fetch video data");
      setSavingVideo(false);
    }
  }

  async function saveVideoToSupabase(videoData: any) {
    if (!profile) return;
    
    try {
      const videoToInsert = {
        user_id: profile.id,
        title: videoData.title,
        channel_title: videoData.channelTitle,
        duration: videoData.duration,
        thumbnail_url: videoData.thumbnailUrl,
        video_id: videoData.videoId
      };

      const { error } = await supabase
        .from('videos')
        .insert(videoToInsert as any);
        
      if (error) {
        throw error;
      }
      
      // Refresh the videos list
      const { data: videosData, error: videosError } = (await supabase
        .from("videos")
        .select("*")
        .eq("user_id", profile.id)
        .order("created_at", { ascending: false })) as {
        data: VideoRow[] | null;
        error: any;
      };

      if (videosError) {
        console.error("[PublicProfile] Error refreshing videos:", videosError);
      } else {
        setVideos(videosData || []);
      }
    } catch (error: any) {
      console.error('Error saving video:', error);
      setInputError(`Failed to save video: ${error.message}`);
    }
  }

  function handleSubmit() {
    setInputError(null);
    
    const videoId = extractYouTubeVideoId(inputValue);
    if (!videoId) {
      setInputError("INVALID YOUTUBE URL");
      setInputValue("");
      return;
    }

    // Check if this video is already in the user's archive
    const alreadySaved = videos.some((v) => v.video_id === videoId);
    if (alreadySaved) {
      setInputError("ALREADY IN YOUR ARCHIVE");
      setInputValue("");
      return;
    }
    
    fetchYouTubeData(videoId);
  }

  const addInputState = {
    showInput,
    inputValue,
    inputError,
    onToggle: toggleInput,
    onChange: handleInputChange,
    onSubmit: handleSubmit,
  };

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
        showAddControl={isOwnProfile}
        addInputState={isOwnProfile ? addInputState : undefined}
        onToggleAddInput={toggleInput}
        addControlRef={addControlRef}
      />
    </main>
  );
}
