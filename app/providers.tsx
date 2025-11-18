"use client";

import { YouTubePlayerProvider } from "@/hooks/useYouTubePlayer";
import { ReactNode } from "react";

export function Providers({ children }: { children: ReactNode }) {
  return <YouTubePlayerProvider>{children}</YouTubePlayerProvider>;
}


