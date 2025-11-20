"use client";

import { IBM_Plex_Mono } from "next/font/google";
import type { RefObject } from "react";
import VinylStack3D, { VinylStackItem } from "./VinylStack3D";

const ibmPlexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export interface AddInputState {
  showInput: boolean;
  inputValue: string;
  inputError: string | null;
  onToggle: () => void;
  onChange: (value: string) => void;
  onSubmit: () => void;
}

export interface ProfileExperienceProps {
  shareCopied: boolean;
  onCopyProfileUrl?: () => void;
  onSignOut?: () => void;
  showOwnerActions?: boolean;
  videos: VinylStackItem[];
  isPlaying?: boolean;
  currentTime?: number;
  clearSelectionKey?: number;
  onRequestPlay?: (videoId: string) => void;
  onRequestToggle?: (videoId: string) => void;
  onSeek?: (deltaSeconds: number) => void;
  onDelete?: (item: VinylStackItem) => void;
  showAddControl?: boolean;
  addInputState?: AddInputState;
  activeVideoId?: string | null;
  onToggleAddInput?: () => void;
  onCloseActive?: () => void;
  onHomeClick?: () => void;
  addControlRef?: RefObject<HTMLDivElement | null>;
}

export default function ProfileExperience({
  shareCopied,
  onCopyProfileUrl,
  onSignOut,
  showOwnerActions = true,
  videos,
  isPlaying = false,
  currentTime = 0,
  clearSelectionKey,
  onRequestPlay,
  onRequestToggle,
  onSeek,
  onDelete,
  showAddControl = true,
  addInputState,
  activeVideoId,
  onToggleAddInput,
  onCloseActive,
  onHomeClick,
  addControlRef,
}: ProfileExperienceProps) {
  const handleShare = () => {
    onCopyProfileUrl?.();
  };

  return (
    <>
      <div
        className={`
          fixed top-8 left-8 text-left
          transition-opacity duration-1000
          ${activeVideoId ? "z-0 opacity-0 pointer-events-none" : "z-40 opacity-100"}
          ${ibmPlexMono.className}
        `}
      >
        <div className="inline-block">
          <h1 className="text-6xl font-normal tracking-normal text-black">
            MIXCHIEF
          </h1>
          <p className="mt-12 text-sm font-bold leading-relaxed text-black text-justify max-w-68">
            A SPACE TO SAVE YOUR FAVORITE MIXES FROM ACROSS THE INTERNET IN ONE HOME.
          </p>
        </div>

        <div className="mt-12 flex flex-col gap-1 text-sm font-bold tracking-[0.18em]">
          <button
            type="button"
            className="text-gray-500 hover:text-black transition-colors text-left"
            onClick={onHomeClick}
          >
            HOME
          </button>
          <button
            type="button"
            onClick={handleShare}
            className="text-gray-500 hover:text-black transition-colors text-left"
          >
            {shareCopied ? "PROFILE LINK COPIED" : "SHARE PROFILE"}
          </button>
          {showOwnerActions && onSignOut && (
            <button
              type="button"
              onClick={onSignOut}
              className="text-gray-500 hover:text-black transition-colors text-left"
            >
              SIGN OUT
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col items-center">
        <div className="mt-8 w-full lg:w-screen self-stretch max-w-none overflow-visible px-4 md:px-6 lg:px-10 xl:px-16">
          <VinylStack3D
            items={videos}
            onRequestPlay={onRequestPlay}
            onRequestToggle={onRequestToggle}
            onSeek={onSeek}
            isPlaying={isPlaying}
            currentTime={currentTime}
            clearSelectionKey={clearSelectionKey}
            onDelete={onDelete}
          />
        </div>
      </div>

      {/* Close button - always visible when there's an active video */}
      {activeVideoId && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center h-20 w-20">
          <button
            type="button"
            onClick={() => onCloseActive?.()}
            className="
              absolute inset-0
              flex items-center justify-center
              bg-transparent
              focus:outline-none
              z-20
            "
            aria-label="Close player"
          >
            <span className="relative block h-14 w-14 transition-transform duration-200 rotate-45">
              <span
                className="
                  absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
                  h-14 w-[10px] bg-black
                "
              />
              <span
                className="
                  absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
                  w-14 h-[10px] bg-black
                "
              />
            </span>
          </button>
        </div>
      )}

      {/* Add control - only visible for profile owner when no video is playing */}
      {showAddControl && !activeVideoId && (
        <div
          ref={addControlRef}
          className="
            fixed bottom-6 right-6 z-50
            flex items-center
            h-20 w-20
          "
        >
          <div className="relative h-full w-full">
            {addInputState?.showInput && (
              <div
                className={`
                  absolute top-1/2 -translate-y-1/2
                  h-14 w-[320px] bg-black text-white
                  flex items-center px-4 gap-3
                  text-xs tracking-[0.18em]
                  ${ibmPlexMono.className}
                  z-30
                `}
                style={{ right: "calc(50% + 5px)" }}
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  type="text"
                  value={addInputState.inputValue}
                  onChange={(event) => addInputState.onChange(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      addInputState.onSubmit();
                    }
                  }}
                  placeholder={addInputState.inputError || "PASTE YOUTUBE LINK"}
                  className={`
                    flex-1 bg-transparent border-none outline-none uppercase
                    ${addInputState.inputError ? "placeholder-red-500 text-red-300" : "placeholder-gray-200 text-white"}
                  `}
                />
              </div>
            )}

            <button
              type="button"
              onClick={onToggleAddInput}
              className="
                absolute inset-0
                flex items-center justify-center
                bg-transparent
                focus:outline-none
                z-20
              "
              aria-label="Add mix"
            >
              <span className="relative block h-14 w-14 transition-transform duration-200">
                <span
                  className="
                    absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2
                    h-14 w-[10px] bg-black
                  "
                />
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
      )}
    </>
  );
}

