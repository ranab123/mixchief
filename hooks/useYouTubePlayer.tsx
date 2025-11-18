"use client";

import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";

interface YouTubePlayerContextValue {
  activeVideoId: string | null;
  isPlaying: boolean;
  currentTime: number;
  activeLabelSrc: string | null;
  playOrToggle: (videoId: string, fadeIn?: boolean, labelSrc?: string | null) => void;
  handleSeek: (deltaSeconds: number) => void;
  stop: () => void;
}

const YouTubePlayerContext = createContext<YouTubePlayerContextValue | undefined>(
  undefined
);

export function YouTubePlayerProvider({ children }: { children: ReactNode }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [activeVideoId, setActiveVideoId] = useState<string | null>(null);
  const [currentTime, setCurrentTime] = useState(0);
  const [activeLabelSrc, setActiveLabelSrc] = useState<string | null>(null);

  const playerRef = useRef<any>(null);
  const apiReadyRef = useRef(false);
  const pendingVideoRef = useRef<
    | { id: string; fadeIn: boolean; labelSrc?: string | null }
    | null
  >(null);

  // Ensure the hidden container exists exactly once in the DOM
  useEffect(() => {
    if (typeof document === "undefined") return;
    let holder = document.getElementById("hidden-yt-player-holder");
    if (!holder) {
      holder = document.createElement("div");
      holder.id = "hidden-yt-player-holder";
      holder.style.position = "absolute";
      holder.style.width = "1px";
      holder.style.height = "1px";
      holder.style.left = "-9999px";
      holder.style.top = "-9999px";
      holder.style.pointerEvents = "none";
      holder.style.opacity = "0";
      // Inner div that YT will replace with iframe
      const inner = document.createElement("div");
      inner.id = "hidden-yt-player";
      holder.appendChild(inner);
      document.body.appendChild(holder);
    }
  }, []);

  // Load YouTube IFrame API & create player once
  useEffect(() => {
    if (typeof window === "undefined") return;
    const w = window as any;

    function instantiate() {
      apiReadyRef.current = true;
      if (!playerRef.current) {
        playerRef.current = new w.YT.Player("hidden-yt-player", {
          width: "1",
          height: "1",
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
            onStateChange: (e: any) => {
              const YTState = w.YT?.PlayerState ?? {};
              if (e.data === YTState.PLAYING) setIsPlaying(true);
              else if ([YTState.PAUSED, YTState.ENDED].includes(e.data))
                setIsPlaying(false);
            },
          },
        });
      }

      // If user already requested a video while API was loading, honour it now
      if (pendingVideoRef.current) {
        const { id, fadeIn, labelSrc } = pendingVideoRef.current;
        pendingVideoRef.current = null;
        setTimeout(() => playOrToggle(id, fadeIn, labelSrc), 0);
      }
    }

    if (w.YT && w.YT.Player) {
      instantiate();
      return;
    }

    // Inject script if not yet present
    if (!document.getElementById("yt-iframe-api")) {
      const tag = document.createElement("script");
      tag.id = "yt-iframe-api";
      tag.src = "https://www.youtube.com/iframe_api";
      document.body.appendChild(tag);
    }

    w.onYouTubeIframeAPIReady = instantiate;

    return () => {
      // cleanup callback overwritten only when unmounting provider; destroy player
      if (playerRef.current && playerRef.current.destroy) {
        try {
          playerRef.current.destroy();
        } catch {}
      }
    };
  }, []);

  // Poll current time every 200 ms
  useEffect(() => {
    const id = setInterval(() => {
      if (playerRef.current && apiReadyRef.current && playerRef.current.getCurrentTime) {
        setCurrentTime(playerRef.current.getCurrentTime());
      }
    }, 200);
    return () => clearInterval(id);
  }, []);

  function playOrToggle(
    videoId: string,
    fadeIn = false,
    labelSrc?: string | null
  ) {
    if (!playerRef.current || !apiReadyRef.current) {
      // queue until ready
      pendingVideoRef.current = { id: videoId, fadeIn, labelSrc };
      return;
    }

    const w = window as any;
    const YTState = w.YT?.PlayerState ?? {};
    const player = playerRef.current;

    if (activeVideoId === videoId) {
      const state = player.getPlayerState?.();
      if (state === YTState.PLAYING) player.pauseVideo?.();
      else {
        player.playVideo?.();
        player.unMute?.();
        player.setVolume?.(100);
      }
      setActiveLabelSrc(labelSrc ?? activeLabelSrc);
      return;
    }

    setActiveVideoId(videoId);
    setCurrentTime(0);
    setActiveLabelSrc(labelSrc ?? null);

    player.loadVideoById?.(videoId);
    player.unMute?.();

    if (fadeIn) {
      player.setVolume?.(0);
      let vol = 0;
      const step = setInterval(() => {
        vol += 2;
        if (vol >= 100) {
          vol = 100;
          clearInterval(step);
        }
        player.setVolume?.(vol);
      }, 60);
    } else {
      player.setVolume?.(100);
    }
  }

  function handleSeek(deltaSeconds: number) {
    const player = playerRef.current;
    if (!player || !apiReadyRef.current) return;
    try {
      const cur = player.getCurrentTime?.() ?? 0;
      const dur = player.getDuration?.() ?? NaN;
      let next = cur + deltaSeconds;
      if (!Number.isNaN(dur) && dur > 0) next = Math.min(next, Math.max(0, dur - 0.5));
      next = Math.max(0, next);
      player.seekTo?.(next, true);
      setCurrentTime(next);
    } catch {}
  }

  function stop() {
    const player = playerRef.current;
    if (player && apiReadyRef.current) {
      try {
        player.stopVideo?.();
      } catch {}
    }
    setActiveVideoId(null);
    setCurrentTime(0);
    setActiveLabelSrc(null);
    setIsPlaying(false);
  }

  const value: YouTubePlayerContextValue = {
    activeVideoId,
    isPlaying,
    currentTime,
    activeLabelSrc,
    playOrToggle,
    handleSeek,
    stop,
  };

  return (
    <YouTubePlayerContext.Provider value={value}>
      {children}
    </YouTubePlayerContext.Provider>
  );
}

export function useYouTubePlayer() {
  const ctx = useContext(YouTubePlayerContext);
  if (!ctx) throw new Error("useYouTubePlayer must be used within YouTubePlayerProvider");
  return ctx;
}
