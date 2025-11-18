"use client";
import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import ProfileExperience from "./components/ProfileExperience";
import UsernameSetup from "./components/UsernameSetup";
import { useYouTubePlayer } from "@/hooks/useYouTubePlayer";
import { useVinylPlayer } from "@/hooks/useVinylPlayer";
import { buildProfileUrl } from "@/lib/url";
 

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

interface UserProfile {
  id: string;
  username: string;
  display_name: string | null;
}

function sanitizeUsernameCandidate(candidate?: string | null) {
  if (!candidate) return null;
  const sanitized = candidate.toLowerCase().replace(/[^a-z0-9_]/g, "");
  if (sanitized.length < 3) return null;
  return sanitized.slice(0, 32);
}

async function isUsernameAvailable(username: string) {
  try {
    const { data, error } = await supabase.rpc("check_username_available", {
      username_to_check: username,
    } as any);
    if (error) {
      console.error("Error checking username availability:", error);
      return false;
    }
    return !!data;
  } catch (error) {
    console.error("Unexpected error checking username availability:", error);
    return false;
  }
}

async function generateUniqueUsername(user: User) {
  const baseCandidates = [
    user.user_metadata?.preferred_username,
    user.user_metadata?.user_name,
    user.user_metadata?.full_name?.split(" ")?.[0],
    user.email?.split("@")?.[0],
  ]
    .map(sanitizeUsernameCandidate)
    .filter(Boolean) as string[];

  const fallbackBase =
    sanitizeUsernameCandidate(`dj${user.id?.replace(/[^a-z0-9]/gi, "").slice(0, 8)}`) ||
    `dj${Math.floor(Math.random() * 10_000)}`;

  const candidates = [...baseCandidates, fallbackBase];

  for (let i = 0; i < candidates.length; i += 1) {
    const candidate = candidates[i]!;
    const available = await isUsernameAvailable(candidate);
    if (available) {
      return candidate;
    }
  }

  // As a final fallback, append random digits until we find an available username
  for (let suffix = 1; suffix < 1000; suffix += 1) {
    const candidate = `${fallbackBase}${suffix}`;
    if (await isUsernameAvailable(candidate)) {
      return candidate;
    }
  }

  return `dj${Date.now()}`;
}

async function ensureProfileExists(user: User): Promise<UserProfile | null> {
  try {
    const { data: profileData, error: profileError } = await supabase
      .from("profiles")
      .select("id, username, display_name")
      .eq("id", user.id)
      .maybeSingle();

    if (profileError && profileError.code !== "PGRST116") {
      throw profileError;
    }

    if (profileData) {
      return profileData;
    }

    const username = await generateUniqueUsername(user);
    const displayName =
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      username;

    const { data: insertedProfile, error: insertError } = await supabase
      .from("profiles")
      .insert(
        {
          id: user.id,
          username,
          display_name: displayName,
        } as any
      )
      .select("id, username, display_name")
      .single();

    if (insertError) {
      throw insertError;
    }

    return insertedProfile;
  } catch (error) {
    console.error("Error ensuring profile exists:", error);
    return null;
  }
}

export default function Home() {
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [showInput, setShowInput] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [inputError, setInputError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const [videos, setVideos] = useState<VideoData[]>([]);
  const [shareCopied, setShareCopied] = useState<boolean>(false);
 
  const shareCopiedTimeoutRef = useRef<number | null>(null);
  const addControlRef = useRef<HTMLDivElement | null>(null);
  const hasRedirectedRef = useRef(false);
  const router = useRouter();

  // Use singleton YouTube player and vinyl UI logic from hooks
  const { activeVideoId, isPlaying, currentTime, activeLabelSrc, playOrToggle, handleSeek, stop } = useYouTubePlayer();
  const { clearSelectionKey, setClearSelectionKey } = useVinylPlayer();

  useEffect(() => {
    async function loadUserData() {
      try {
        setAuthLoading(true);
        
        // Get authentication data
        const { data: authData, error: authError } = await supabase.auth.getUser();

        if (authError) {
          if (authError.name === "AuthSessionMissingError") {
            // User is simply not signed in; treat as anonymous without throwing
            setUser(null);
            setProfile(null);
            setAuthLoading(false);
            setProfileLoading(false);
            return;
          }
          throw authError;
        }
        
        if (!authData.user) {
          // No authenticated user
          setAuthLoading(false);
          setProfile(null);
          setUser(null);
          return;
        }
        
        setUser(authData.user);
        
        // User is authenticated, now check for profile
        setProfileLoading(true);
        
        const ensuredProfile = await ensureProfileExists(authData.user);

        if (ensuredProfile) {
          setProfile(ensuredProfile);
          fetchSavedVideos(authData.user.id);
        } else {
          setProfile(null);
        }
      } catch (error) {
        console.error('Error during authentication:', error);
      } finally {
        setAuthLoading(false);
        setProfileLoading(false);
      }
    }
    
    loadUserData();
  }, []);

  useEffect(() => {
    if (!profile || !user) {
      hasRedirectedRef.current = false;
      return;
    }

    if (hasRedirectedRef.current) return;
    hasRedirectedRef.current = true;
    router.push(`/profile/${profile.username}`);
  }, [profile, user, router]);

  // Disable body scroll; only the stack handles wheel scrolling
  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  // Cleanup share-copied timeout on unmount
  useEffect(() => {
    return () => {
      if (shareCopiedTimeoutRef.current) {
        window.clearTimeout(shareCopiedTimeoutRef.current);
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

  function handleCloseActive() {
    // Stop the YouTube player and clear active video
    stop();
    // Clear vinyl selection in VinylStack3D
    setClearSelectionKey((k) => k + 1);
  }
  
  async function fetchSavedVideos(userId: string) {
    try {
      // Type assertion for Supabase query
      const { data, error } = await supabase
        .from('videos')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false }) as { 
          data: any[] | null; 
          error: any 
        };
        
      if (error) {
        console.error('Error fetching videos:', error);
        return;
      }
      
      if (data && Array.isArray(data)) {
        const formattedVideos = data.map(video => ({
          title: video.title || '',
          channelTitle: video.channel_title || '',
          duration: video.duration || '',
          thumbnailUrl: video.thumbnail_url || '',
          videoId: video.video_id || '',
          id: video.id || '',
          created_at: video.created_at || '',
          user_id: video.user_id || ''
        }));
        setVideos(formattedVideos);
      }
    } catch (error) {
      console.error('Error fetching videos:', error);
    }
  }

  async function signIn() {
    await supabase.auth.signInWithOAuth({ provider: "google" });
  }

  async function signOut() {
    await supabase.auth.signOut();
    setUser(null);
    setProfile(null);
    setVideos([]);
    hasRedirectedRef.current = false;
  }
  
  async function handleUsernameSetup(username: string) {
    // Fetch the complete profile after username setup
    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, display_name')
      .eq('id', user.id)
      .single();
      
    if (data) {
      setProfile(data);
      fetchSavedVideos(user.id);
    } else if (error) {
      console.error('Error fetching profile after setup:', error);
    }
  }
  
  function toggleInput() {
    setShowInput(!showInput);
    setError(null);
  }

  function handleInputChange(value: string) {
    setInputValue(value);
    if (inputError) {
      setInputError(null);
    }
  }
  
  function copyProfileUrl() {
    if (typeof window !== 'undefined' && profile) {
      const url = buildProfileUrl(profile.username);
      navigator.clipboard.writeText(url);
      // Update UI state to show "PROFILE LINK COPIED" for a few seconds
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
      setLoading(true);
      setError(null);
      
      // Use our server-side API route to protect the API key
      const response = await fetch(`/api/youtube?videoId=${videoId}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to fetch video data');
      }
      
      const videoData = await response.json();
      
      if (user) {
        await saveVideoToSupabase(videoData);
      }
      
      setLoading(false);
      setInputValue(''); // Clear input after successful submission
      setShowInput(false); // Hide input after successful submission
    } catch (error: any) {
      setError(error.message || "Failed to fetch video data");
      setLoading(false);
    }
  }
  
  async function saveVideoToSupabase(videoData: VideoData) {
    try {
      // Type assertion to match the expected structure
      const videoToInsert = {
        user_id: user.id,
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
      fetchSavedVideos(user.id);
    } catch (error: any) {
      console.error('Error saving video:', error);
      setError(`Failed to save video: ${error.message}`);
    }
  }

  async function deleteVideoById(id: string) {
    try {
      const { error } = await supabase
        .from('videos')
        .delete()
        .eq('id', id);
      if (error) throw error;
      setVideos((prev) => prev.filter((v) => v.id !== id));
    } catch (err) {
      console.error('Error deleting video:', err);
      alert('Failed to delete. Please try again.');
    }
  }
  
  function handleSubmit() {
    setError(null);
    setInputError(null);
    
    const videoId = extractYouTubeVideoId(inputValue);
    if (!videoId) {
      setInputError("INVALID YOUTUBE URL");
      setInputValue("");
      return;
    }

    // Check if this video is already in the user's archive
    const alreadySaved = videos.some((v) => v.videoId === videoId);
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

  const vinylItems = videos.map((v) => ({
    src: v.thumbnailUrl,
    videoId: v.videoId,
    id: v.id,
    title: v.title,
    channelTitle: v.channelTitle,
    created_at: v.created_at,
    duration: v.duration,
  }));

  return (
    <main className="flex flex-col items-center justify-center min-h-screen py-8 relative">
      {authLoading ? (
        <div className="mt-8 flex flex-col items-center">
          <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-2 text-sm text-gray-500">Loading...</p>
        </div>
      ) : !user ? (
        <button onClick={signIn} className="mt-4 p-2 bg-black text-white rounded">
          Sign in with Google
        </button>
      ) : profileLoading ? (
        <div className="mt-8 flex flex-col items-center">
          <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
          <p className="mt-2 text-sm text-gray-500">Loading profile...</p>
        </div>
      ) : !profile ? (
        <div className="mt-8">
          <UsernameSetup
            userId={user.id}
            userEmail={user.email}
            onComplete={handleUsernameSetup}
          />
        </div>
      ) : (
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
      )}
    </main>
  );
}
