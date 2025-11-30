"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import ProfileExperience from "@/app/components/ProfileExperience";
import UsernameSetup from "@/app/components/UsernameSetup";
import { useYouTubePlayer } from "@/hooks/useYouTubePlayer";
import { useVinylPlayer } from "@/hooks/useVinylPlayer";
import { buildProfileUrl } from "@/lib/url";
import { ensureProfileExists, type UserProfile } from "@/lib/profile";

interface VideoData {
  title: string;
  channelTitle: string;
  duration: string;
  thumbnailUrl: string;
  videoId: string;
  id?: string;
  created_at?: string;
  user_id?: string;
}

export default function ProfilePage() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [videos, setVideos] = useState<VideoData[]>([]);
  const [showInput, setShowInput] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [inputError, setInputError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [shareCopied, setShareCopied] = useState(false);

  const shareCopiedTimeoutRef = useRef<number | null>(null);
  const addControlRef = useRef<HTMLDivElement | null>(null);
  const router = useRouter();

  const {
    activeVideoId,
    isPlaying,
    currentTime,
    playOrToggle,
    handleSeek,
    stop,
  } = useYouTubePlayer();
  const { clearSelectionKey, setClearSelectionKey } = useVinylPlayer();

  useEffect(() => {
    if (activeVideoId) {
      setShowInput(false);
    }
  }, [activeVideoId]);

  useEffect(() => {
    async function loadUserData() {
      try {
        setAuthLoading(true);
        const { data: authData, error: authError } = await supabase.auth.getUser();

        if (authError) {
          if (authError.name === "AuthSessionMissingError") {
            router.replace("/");
            return;
          }
          throw authError;
        }

        if (!authData.user) {
          router.replace("/");
          setUser(null);
          setProfile(null);
          setVideos([]);
          return;
        }

        setUser(authData.user);
        setProfileLoading(true);

        const ensuredProfile = await ensureProfileExists(authData.user);
        if (ensuredProfile) {
          setProfile(ensuredProfile);
          fetchSavedVideos(authData.user.id);
        } else {
          setProfile(null);
        }
      } catch (error) {
        console.error("Error loading profile page data:", error);
      } finally {
        setAuthLoading(false);
        setProfileLoading(false);
      }
    }

    loadUserData();
  }, [router]);

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    return () => {
      if (shareCopiedTimeoutRef.current) {
        window.clearTimeout(shareCopiedTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (!showInput) return;

    function handleDocumentClick(event: MouseEvent) {
      if (!addControlRef.current) return;
      const target = event.target as Node | null;
      if (target && !addControlRef.current.contains(target)) {
        setShowInput(false);
      }
    }

    document.addEventListener("mousedown", handleDocumentClick);
    return () => {
      document.removeEventListener("mousedown", handleDocumentClick);
    };
  }, [showInput]);

  function handleCloseActive() {
    stop();
    setClearSelectionKey((k) => k + 1);
    setShowInput(false);
  }

  async function fetchSavedVideos(userId: string) {
    try {
      const { data, error } = (await supabase
        .from("videos")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })) as {
        data: any[] | null;
        error: any;
      };

      if (error) {
        console.error("Error fetching videos:", error);
        return;
      }

      if (data && Array.isArray(data)) {
        const formattedVideos = data.map((video) => ({
          title: video.title || "",
          channelTitle: video.channel_title || "",
          duration: video.duration || "",
          thumbnailUrl: video.thumbnail_url || "",
          videoId: video.video_id || "",
          id: video.id || "",
          created_at: video.created_at || "",
          user_id: video.user_id || "",
        }));
        setVideos(formattedVideos);
      }
    } catch (error) {
      console.error("Error fetching videos:", error);
    }
  }

  async function saveVideoToSupabase(videoData: VideoData) {
    if (!user) return;
    try {
      const videoToInsert = {
        user_id: user.id,
        title: videoData.title,
        channel_title: videoData.channelTitle,
        duration: videoData.duration,
        thumbnail_url: videoData.thumbnailUrl,
        video_id: videoData.videoId,
      };

      const { error } = await supabase.from("videos").insert(videoToInsert as any);

      if (error) {
        throw error;
      }

      fetchSavedVideos(user.id);
    } catch (error: any) {
      console.error("Error saving video:", error);
      alert(`Failed to save video: ${error.message}`);
    }
  }

  async function deleteVideoById(id: string) {
    try {
      const { error } = await supabase.from("videos").delete().eq("id", id);
      if (error) throw error;
      setVideos((prev) => prev.filter((v) => v.id !== id));
    } catch (err) {
      console.error("Error deleting video:", err);
      alert("Failed to delete. Please try again.");
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
    const regexPatterns = [
      /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/|youtube\.com\/v\/|youtube\.com\/user\/.+\/\w{11}|youtube\.com\/\w{11})([^&?\n]+)/,
      /youtube\.com\/watch\?.*v=([^&]+)/,
      /youtu\.be\/([^?&]+)/,
      /youtube\.com\/embed\/([^?&]+)/,
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
      setInputError(null);
      const response = await fetch(`/api/youtube?videoId=${videoId}`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to fetch video data");
      }

      const videoData = await response.json();

      if (user) {
        await saveVideoToSupabase(videoData);
      }

      setInputValue("");
      setShowInput(false);
    } catch (error: any) {
      console.error("Failed to fetch video data", error);
      setInputError(error.message || "Failed to fetch video data");
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

    const alreadySaved = videos.some((v) => v.videoId === videoId);
    if (alreadySaved) {
      setInputError("ALREADY IN YOUR ARCHIVE");
      setInputValue("");
      return;
    }

    fetchYouTubeData(videoId);
  }

  function copyProfileUrl() {
    if (typeof window !== "undefined" && profile) {
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
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setVideos([]);
    router.push("/");
  }

  async function handleUsernameSetup(_username: string) {
    if (!user) return;
    const { data, error } = await supabase
      .from("profiles")
      .select("id, username, display_name")
      .eq("id", user.id)
      .single();

    if (data) {
      setProfile(data);
      fetchSavedVideos(user.id);
    } else if (error) {
      console.error("Error fetching profile after setup:", error);
    }
  }

  const addInputState = {
    showInput,
    inputValue,
    inputError,
    onToggle: toggleInput,
    onChange: handleInputChange,
    onSubmit: handleSubmit,
  };

  const vinylItems = videos.map((v) => ({
    src: v.thumbnailUrl,
    videoId: v.videoId,
    id: v.id,
    title: v.title,
    channelTitle: v.channelTitle,
    created_at: v.created_at,
    duration: v.duration,
  }));

  if (authLoading) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen py-8 relative">
        <div className="mt-8 flex flex-col items-center">
          <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin" />
          <p className="mt-2 text-sm text-gray-500">Loading...</p>
        </div>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  if (profileLoading) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen py-8 relative">
        <div className="mt-8 flex flex-col items-center">
          <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin" />
          <p className="mt-2 text-sm text-gray-500">Loading profile...</p>
        </div>
      </main>
    );
  }

  if (!profile) {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen py-8 relative">
        <div className="mt-8">
          {/* Ensure user.id and user.email are strings */}
          <UsernameSetup
            userId={String(user.id)}
            userEmail={String(user.email)}
            onComplete={handleUsernameSetup}
          />
        </div>
      </main>
    );
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-screen py-8 relative">
      <ProfileExperience
        shareCopied={shareCopied}
        onCopyProfileUrl={copyProfileUrl}
        onSignOut={signOut}
        showOwnerActions
        videos={vinylItems}
        isPlaying={isPlaying}
        currentTime={currentTime}
        clearSelectionKey={clearSelectionKey}
        onRequestPlay={(videoId) => playOrToggle(videoId, true)}
        onRequestToggle={(videoId) => playOrToggle(videoId, false)}
        onSeek={handleSeek}
        onDelete={(item) => {
          if (item.id) {
            deleteVideoById(item.id);
          }
        }}
        showAddControl
        addInputState={addInputState}
        activeVideoId={activeVideoId}
        onToggleAddInput={toggleInput}
        onCloseActive={handleCloseActive}
        addControlRef={addControlRef}
      />
    </main>
  );
}
