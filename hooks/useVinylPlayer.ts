"use client";

import { useEffect, useState } from "react";
import { useYouTubePlayer } from "./useYouTubePlayer";

export function useVinylPlayer() {
  const [clearSelectionKey, setClearSelectionKey] = useState<number>(0);

  // Get YouTube player state and controls from context
  const yt = useYouTubePlayer();

  useEffect(() => {
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, []);

  useEffect(() => {
    const style = document.createElement("style");
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

  return {
    // YouTube player state and controls from context
    activeVideoId: yt.activeVideoId,
    isPlaying: yt.isPlaying,
    currentTime: yt.currentTime,
    activeLabelSrc: yt.activeLabelSrc,
    playOrToggle: yt.playOrToggle,
    handleSeek: yt.handleSeek,
    stop: yt.stop,
    // Vinyl-specific UI state
    clearSelectionKey,
    setClearSelectionKey,
  };
}
