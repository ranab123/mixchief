"use client";
import { useEffect, useState, useRef } from "react";
import { IBM_Plex_Mono } from "next/font/google";
import { supabase } from "@/lib/supabaseClient";
import VinylStack3D from "./components/VinylStack3D";
import UsernameSetup from "./components/UsernameSetup";
 

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

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

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
  const [activeLabelSrc, setActiveLabelSrc] = useState<string | null>(null);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [shareCopied, setShareCopied] = useState<boolean>(false);
 
  const playerRef = useRef<any>(null);
  const apiReadyRef = useRef<boolean>(false);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const rotationAngleRef = useRef<number>(0);
  const rafRef = useRef<number | null>(null);
  const lastTsRef = useRef<number | null>(null);
  const rotationMsPerRevRef = useRef<number>(6000); // 6s per full rotation
  const shareCopiedTimeoutRef = useRef<number | null>(null);
  const addControlRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    async function loadUserData() {
      try {
        setAuthLoading(true);
        
        // Get authentication data
        const { data: authData } = await supabase.auth.getUser();
        
        if (!authData.user) {
          // No authenticated user
          setAuthLoading(false);
          return;
        }
        
        setUser(authData.user);
        
        // User is authenticated, now check for profile
        setProfileLoading(true);
        
        // Check if user has a profile with username
        const { data: profileData, error } = await supabase
          .from('profiles')
          .select('id, username, display_name')
          .eq('id', authData.user.id)
          .single();
        
        if (profileData) {
          setProfile(profileData);
          fetchSavedVideos(authData.user.id);
        } else if (error) {
          console.error('Error fetching profile:', error);
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
  // Load YouTube IFrame API once and create a hidden player
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const w = window as any;
    if (w.YT && w.YT.Player) {
      apiReadyRef.current = true;
      if (!playerRef.current) {
        playerRef.current = new w.YT.Player('hidden-yt-player', {
          width: '1',
          height: '1',
          playerVars: {
            autoplay: 0,
            controls: 0,
            modestbranding: 1,
            rel: 0,
            fs: 0,
            iv_load_policy: 3,
            playsinline: 1,
          },
          events: {
            onReady: () => {
              console.log('[YouTube Player] onReady fired');
            },
            onStateChange: (e: any) => {
              console.log('[YouTube Player] onStateChange:', e.data);
              const YTState = (w.YT && w.YT.PlayerState) ? w.YT.PlayerState : {};
              console.log('[YouTube Player] YTState constants:', YTState);
              if (e.data === YTState.PLAYING) {
                console.log('[YouTube Player] State: PLAYING');
                setIsPlaying(true);
              }
              if (e.data === YTState.PAUSED || e.data === YTState.ENDED) {
                console.log('[YouTube Player] State: PAUSED or ENDED');
                setIsPlaying(false);
              }
            },
          },
        });
      }
      return;
    }

    // Inject script if not present
    const existing = document.getElementById('yt-iframe-api');
    if (!existing) {
      const tag = document.createElement('script');
      tag.id = 'yt-iframe-api';
      tag.src = 'https://www.youtube.com/iframe_api';
      document.body.appendChild(tag);
    }

    (w as any).onYouTubeIframeAPIReady = () => {
      apiReadyRef.current = true;
      if (!playerRef.current) {
        playerRef.current = new w.YT.Player('hidden-yt-player', {
          width: '1',
          height: '1',
          playerVars: {
            autoplay: 0,
            controls: 0,
            modestbranding: 1,
            rel: 0,
            fs: 0,
            iv_load_policy: 3,
            playsinline: 1,
          },
          events: {
            onReady: () => {
              console.log('[YouTube Player] onReady fired (from API ready callback)');
            },
            onStateChange: (e: any) => {
              console.log('[YouTube Player] onStateChange (from API ready callback):', e.data);
              const YTState = (w.YT && w.YT.PlayerState) ? w.YT.PlayerState : {};
              console.log('[YouTube Player] YTState constants:', YTState);

              if (e.data === YTState.PLAYING) {
                console.log('[YouTube Player] State: PLAYING');
                setIsPlaying(true);
              } else if (
                e.data === YTState.PAUSED ||
                e.data === YTState.ENDED ||
                e.data === YTState.UNSTARTED
              ) {
                console.log('[YouTube Player] State: PAUSED / ENDED / UNSTARTED');
                setIsPlaying(false);
              } else if (e.data === YTState.BUFFERING) {
                console.log('[YouTube Player] State: BUFFERING');
              }
            },
          },
        });
      }
    };
  }, []);

  // Poll the YouTube player periodically to keep currentTime in sync
  useEffect(() => {
    const intervalId = setInterval(() => {
      const player = playerRef.current;
      if (player && player.getCurrentTime && apiReadyRef.current) {
        const actualTime = player.getCurrentTime();
        setCurrentTime(actualTime);
      }
    }, 200); // 5 times per second

    return () => clearInterval(intervalId);
  }, []);

  // Spin animation that preserves angle across play/pause
  useEffect(() => {
    const svg = svgRef.current as SVGSVGElement | null;
    if (!svg) return;
    svg.style.transformOrigin = '50% 50%';

    function step(ts: number) {
      if (lastTsRef.current == null) {
        lastTsRef.current = ts;
      }
      const dt = ts - (lastTsRef.current as number);
      lastTsRef.current = ts;
      const degPerMs = 360 / rotationMsPerRevRef.current;
      rotationAngleRef.current = (rotationAngleRef.current + degPerMs * dt) % 360;
      const currentSvg = svgRef.current as SVGSVGElement | null;
      if (currentSvg) {
        currentSvg.style.transform = `rotate(${rotationAngleRef.current}deg)`;
      }
      rafRef.current = requestAnimationFrame(step);
    }

    if (isPlaying) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = requestAnimationFrame(step);
    } else {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
      lastTsRef.current = null;
    }

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    };
  }, [isPlaying]);

  function playOrToggle(videoId: string, fadeIn: boolean = false) {
    console.log('[playOrToggle] Called with videoId:', videoId, 'fadeIn:', fadeIn);
    const w = window as any;
    const YTState = (w?.YT && w.YT.PlayerState) ? w.YT.PlayerState : {};
    const player = playerRef.current;
    console.log('[playOrToggle] player exists:', !!player);
    console.log('[playOrToggle] apiReadyRef.current:', apiReadyRef.current);
    if (!player || !apiReadyRef.current) {
      console.log('[playOrToggle] Player not ready or API not loaded. Aborting.');
      return;
    }
    // If same video, toggle
    if (activeVideoId === videoId) {
      console.log('[playOrToggle] Same video. Toggling play/pause.');
      const state = player.getPlayerState ? player.getPlayerState() : undefined;
      console.log('[playOrToggle] Current player state:', state, 'PLAYING=', YTState.PLAYING, 'PAUSED=', YTState.PAUSED);
      if (state === YTState.PLAYING) {
        console.log('[playOrToggle] Pausing video...');
        player.pauseVideo && player.pauseVideo();
      } else {
        console.log('[playOrToggle] Playing video...');
        player.playVideo && player.playVideo();
        player.unMute && player.unMute();
        player.setVolume && player.setVolume(100);
        console.log('[playOrToggle] Unmuted and set volume to 100');
      }
      return;
    }
    // Load new video and play
    console.log('[playOrToggle] Loading new video:', videoId);
    setActiveVideoId(videoId);
    setCurrentTime(0); // Reset time when loading new video; will be updated by polling once it starts
    if (player.loadVideoById) {
      player.loadVideoById(videoId);
      console.log('[playOrToggle] loadVideoById called');
      player.unMute && player.unMute();
      
      if (fadeIn) {
        // Gradual volume fade from 0 to 100 over 3 seconds
        console.log('[playOrToggle] Starting volume fade-in over 3 seconds');
        player.setVolume && player.setVolume(0);
        let currentVol = 0;
        const fadeInterval = setInterval(() => {
          currentVol += 2; // Increment by 2 every 60ms = 100% in 3s
          if (currentVol >= 100) {
            currentVol = 100;
            clearInterval(fadeInterval);
          }
          player.setVolume && player.setVolume(currentVol);
        }, 60);
      } else {
        player.setVolume && player.setVolume(100);
        console.log('[playOrToggle] Set volume to 100 immediately');
      }
    }
  }

  function stopIfCurrent(videoId?: string | null) {
    const player = playerRef.current;
    if (!player) return;
    if (videoId && activeVideoId !== videoId) return;
    try {
      player.stopVideo && player.stopVideo();
    } catch {}
    setIsPlaying(false);
    setActiveVideoId(null);
  }

  function handleSeek(deltaSeconds: number) {
    const player = playerRef.current;
    if (!player || !apiReadyRef.current) {
      console.log('[handleSeek] Player not ready');
      return;
    }
    
    try {
      const currentTimeVal = player.getCurrentTime ? player.getCurrentTime() : 0;
      const duration = player.getDuration ? player.getDuration() : NaN;
      let newTime = currentTimeVal + deltaSeconds;

      // Clamp within valid video bounds
      if (!Number.isNaN(duration) && duration > 0) {
        const maxTime = Math.max(0, duration - 0.5); // leave a tiny buffer before the real end
        newTime = Math.min(newTime, maxTime);
      }
      newTime = Math.max(0, newTime); // Don't go below 0

      console.log('[handleSeek] Seeking from', currentTimeVal, 'to', newTime, '(delta:', deltaSeconds, ', duration:', duration, ')');
      
      if (player.seekTo) {
        player.seekTo(newTime, true);
        // Update the displayed time immediately
        setCurrentTime(newTime);
      }
    } catch (err) {
      console.error('[handleSeek] Error seeking:', err);
    }
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
  
  function copyProfileUrl() {
    if (typeof window !== 'undefined' && profile) {
      const url = `${window.location.origin}/profile/${profile.username}`;
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

  useEffect(() => {
    const style = document.createElement('style');
    style.textContent = `
      @font-face {
        font-family: 'Anta';
        src: url('/fonts/AntaTrial-Medium.ttf') format('truetype');
        font-weight: 500;
        font-style: normal;
        font-display: swap;
      }
      @font-face {
        font-family: 'Supply';
        src: url('/fonts/Supply-Regular.otf') format('opentype');
        font-weight: 400;
        font-style: normal;
        font-display: swap;
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
    };
  }, []);

  return (
    <main className="flex flex-col items-center justify-center min-h-screen py-8 relative">
      <div id="hidden-yt-player" style={{ position: 'absolute', width: 1, height: 1, left: -9999, top: -9999, pointerEvents: 'none', opacity: 0 }} />
      {isPlaying && activeLabelSrc && (
        <div className="fixed inset-0 z-40 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-md" />
          <div className="relative z-50" style={{ width: '500px', height: '500px' }}>
            <svg
              ref={svgRef}
              width="500"
              height="500"
              viewBox="0 0 1000 1000"
              xmlns="http://www.w3.org/2000/svg"
              xmlnsXlink="http://www.w3.org/1999/xlink"
            >
              <defs>
                <circle id="labelCircle" cx="500" cy="500" r="215" />
                <clipPath id="labelClip">
                  <use xlinkHref="#labelCircle" />
                </clipPath>
                {/* highlight filters (from original svg), camelCased for JSX */}
                <filter id="filterBottomGlow" x="136.996" y="522.001" width="725.121" height="1280.64" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                  <feFlood floodOpacity="0" result="BackgroundImageFix" />
                  <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
                  <feGaussianBlur stdDeviation="75" result="effect1_foregroundBlur" />
                </filter>
                <filter id="filterTopGlow" x="137" y="-807" width="725.121" height="1280.64" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
                  <feFlood floodOpacity="0" result="BackgroundImageFix" />
                  <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
                  <feGaussianBlur stdDeviation="75" result="effect1_foregroundBlur" />
                </filter>
              </defs>

              {/* Disc base */}
              <circle cx="500" cy="500" r="500" fill="#000000" />
              <circle cx="500" cy="500" r="470" fill="#1A1A1A" />
              <circle cx="500" cy="500" r="425" fill="#000000" />
              <circle cx="500" cy="500" r="410" fill="#1A1A1A" />
              <circle cx="500" cy="500" r="375" fill="#000000" />
              <circle cx="500" cy="500" r="370" fill="#1A1A1A" />
              <circle cx="500" cy="500" r="335" fill="#000000" />
              <circle cx="500" cy="500" r="320" fill="#1A1A1A" />
              <circle cx="500" cy="500" r="290" fill="#000000" />
              <circle cx="500" cy="500" r="285" fill="#1A1A1A" />
              {/* Inner black ring from original asset */}
              <circle cx="500" cy="500" r="250" fill="#000000" />

              {/* Album art clipped to label */}
              {activeLabelSrc && (
                <image
                  href={activeLabelSrc}
                  x={500 - 215}
                  y={500 - 215}
                  width={430}
                  height={430}
                  preserveAspectRatio="xMidYMid slice"
                  clipPath="url(#labelClip)"
                />
              )}

              {/* highlight sheen overlays */}
              <g opacity="0.2" filter="url(#filterBottomGlow)">
                <ellipse cx="499.557" cy="1162.32" rx="212.561" ry="490.32" fill="white" />
              </g>
              <g opacity="0.2" filter="url(#filterTopGlow)">
                <ellipse cx="499.561" cy="-166.68" rx="212.561" ry="490.32" fill="white" />
              </g>

              {/* Small spindle hole (hidden) */}
              <circle cx="500" cy="500" r="0" fill="#ffffff" />
            </svg>
          </div>
        </div>
      )}
       
      
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
        <>
          {/* Left column: title, description, nav */}
          <div
            className={`fixed top-8 left-8 z-40 text-left ${ibmPlexMono.className}`}
          >
            <div className="inline-block">
              <h1 className="text-6xl font-normal tracking-normal text-black">
                MIXCHIEF
              </h1>
              {/* Paragraph width matches approx. the character width of "MIXCHIEF" (8 chars) */}
              <p className="mt-12 text-sm font-bold leading-relaxed text-black text-justify max-w-68">
                A SPACE TO SAVE YOUR FAVORITE MIXES FROM ACROSS THE INTERNET IN ONE HOME.
              </p>
            </div>

            <div className="mt-12 flex flex-col gap-1 text-sm font-bold tracking-[0.18em]">
              <button
                type="button"
                className="text-gray-500 hover:text-black transition-colors text-left"
              >
                HOME
              </button>
              <button
                type="button"
                onClick={copyProfileUrl}
                className="text-gray-500 hover:text-black transition-colors text-left"
              >
                {shareCopied ? 'PROFILE LINK COPIED' : 'SHARE PROFILE'}
              </button>
              <button
                type="button"
                onClick={signOut}
                className="text-gray-500 hover:text-black transition-colors text-left"
              >
                SIGN OUT
              </button>
            </div>
          </div>

          {/* Main content (stack) */}
          <div className="flex flex-col items-center">
            <div className="mt-8 w-full lg:w-screen self-stretch max-w-none overflow-visible px-4 md:px-6 lg:px-10 xl:px-16">
              <VinylStack3D 
                items={videos.map(v => ({ src: v.thumbnailUrl, videoId: v.videoId, id: v.id, title: v.title, channelTitle: v.channelTitle, created_at: v.created_at, duration: v.duration }))}
                onRequestPlay={(videoId) => playOrToggle(videoId, true)}
                onRequestToggle={(videoId) => playOrToggle(videoId, false)}
                onSeek={handleSeek}
                isPlaying={isPlaying}
                currentTime={currentTime}
              />
            </div>
          </div>

          {/* Floating plus + static textbox (no animation) in bottom-right */}
          <div
            ref={addControlRef}
            className="
              fixed bottom-6 right-6 z-50
              flex items-center
              h-20 w-20
            "
          >
            <div className="relative h-full w-full">
              {/* Text box overlays on top of the plus and extends to the left */}
              {showInput && (
                <div
                  className={`
                    absolute top-1/2 -translate-y-1/2
                    h-14 w-[320px] bg-black text-white
                    flex items-center px-4 gap-3
                    text-xs tracking-[0.18em]
                    ${ibmPlexMono.className}
                    z-30
                  `}
                  style={{ right: 'calc(50% + 5px)' }}
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="text"
                    value={inputValue}
                    onChange={(e) => {
                      setInputValue(e.target.value);
                      if (inputError) setInputError(null);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        handleSubmit();
                      }
                    }}
                    placeholder={inputError || "PASTE YOUTUBE LINK"}
                    className={`
                      flex-1 bg-transparent border-none outline-none uppercase
                      ${inputError ? 'placeholder-red-500 text-red-300' : 'placeholder-gray-200 text-white'}
                    `}
                  />
                </div>
              )}

              {/* Simple plus / X button (rotates when a vinyl is active) */}
              <button
                type="button"
                onClick={toggleInput}
                className="
                  absolute inset-0
                  flex items-center justify-center
                  bg-transparent
                  focus:outline-none
                  z-20
                "
                aria-label="Add mix"
              >
                <span
                  className={`
                    relative block h-14 w-14
                    transition-transform duration-200
                    ${activeVideoId ? 'rotate-45' : ''}
                  `}
                >
                  {/* Vertical bar */}
                  <span
                    className="
                      absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
                      h-14 w-[10px] bg-black
                    "
                  />
                  {/* Horizontal bar */}
                  <span
                    className="
                      absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
                      w-14 h-[10px] bg-black
                    "
                  />
                </span>
              </button>
            </div>
          </div>
        </>
      )}
    </main>
  );
}
