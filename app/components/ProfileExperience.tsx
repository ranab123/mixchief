"use client";

import { IBM_Plex_Mono } from "next/font/google";
import { useState, useEffect, useRef, useCallback, type RefObject } from "react";
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
  profileUsername?: string;
  totalDurationHours?: string;
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
  profileUsername,
  totalDurationHours,
}: ProfileExperienceProps) {
  const [isClickLocked, setIsClickLocked] = useState(false);
  const [requireMouseLeave, setRequireMouseLeave] = useState(false);
  const [isListView, setIsListView] = useState(false);
  const [externalSelectVideoId, setExternalSelectVideoId] = useState<string | null>(null);
  const prevActiveVideoRef = useRef<string | null | undefined>(activeVideoId);
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const requireMouseLeaveAfterClose = useCallback(() => {
    setRequireMouseLeave(true);
  }, []);

  useEffect(() => {
    const prevActiveVideoId = prevActiveVideoRef.current;
    if (prevActiveVideoId && !activeVideoId) {
      requireMouseLeaveAfterClose();
      // Clear external selection when video stops
      setExternalSelectVideoId(null);
    }
    prevActiveVideoRef.current = activeVideoId ?? null;
  }, [activeVideoId, requireMouseLeaveAfterClose]);

  const handleShare = () => {
    onCopyProfileUrl?.();
  };

  const toggleListView = () => {
    setIsListView(!isListView);
  };

  const handleFeelingLucky = () => {
    if (videos.length === 0) return;
    const randomIndex = Math.floor(Math.random() * videos.length);
    const randomVideo = videos[randomIndex];
    if (randomVideo) {
      // Trigger the vinyl selection animation
      setExternalSelectVideoId(randomVideo.videoId);
    }
  };

  // Calculate total duration in hours
  const calculateTotalDuration = () => {
    if (!videos.length) return "0";
    
    // Parse ISO 8601 duration format (e.g., "PT1H30M45S")
    const totalSeconds = videos.reduce((sum, video) => {
      const duration = video.duration;
      if (!duration) return sum;
      
      // Parse PT1H30M45S format
      const matches = duration.match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/);
      if (!matches) return sum;
      
      const hours = parseInt(matches[1] || "0");
      const minutes = parseInt(matches[2] || "0");
      const seconds = parseInt(matches[3] || "0");
      
      return sum + (hours * 3600 + minutes * 60 + seconds);
    }, 0);
    
    const totalHours = (totalSeconds / 3600).toFixed(1);
    return totalHours;
  };

  const handleButtonClick = () => {
    const isTemporarilyDisabled = requireMouseLeave && !addInputState?.showInput;
    if (isTemporarilyDisabled) {
      return;
    }
    setIsClickLocked(true);
    onToggleAddInput?.();
  };

  const handleMouseLeave = () => {
    if (!isClickLocked && addInputState?.showInput && onToggleAddInput) {
      onToggleAddInput();
    }
    // Reset click lock when mouse leaves
    setIsClickLocked(false);
    if (requireMouseLeave) {
      setRequireMouseLeave(false);
    }
  };

  const handleMouseEnter = () => {
    const isTemporarilyDisabled = requireMouseLeave && !addInputState?.showInput;
    if (isTemporarilyDisabled) {
      return;
    }
    if (!addInputState?.showInput && onToggleAddInput && !isClickLocked) {
      onToggleAddInput();
    }
  };

  // Reset click lock when input closes for any reason
  useEffect(() => {
    if (!addInputState?.showInput) {
      setIsClickLocked(false);
    }
  }, [addInputState?.showInput]);

  return (
    <>
      {/* Header - Left aligned for all screen sizes */}
      <div
        className={`
          fixed top-8 left-4 md:left-8 text-left
          w-[80%] md:w-auto
          transition-opacity duration-1000
          ${activeVideoId ? "z-0 opacity-0 pointer-events-none" : "z-40 opacity-100"}
          ${ibmPlexMono.className}
        `}
      >
        <div className="inline-block">
          {!showOwnerActions ? (
            <button
              type="button"
              onClick={onHomeClick}
              className="text-6xl md:text-6xl font-normal tracking-normal text-black md:hover:text-gray-500 cursor-pointer"
            >
              MIXCHIEF
            </button>
          ) : (
            <h1 className="text-6xl md:text-6xl font-normal tracking-normal text-black">
              MIXCHIEF
            </h1>
          )}
        </div>

        <div className="mt-6 text-black text-sm md:text-sm font-bold tracking-[0.18em]">
          <div className="flex justify-between uppercase">
            <div>
              {showOwnerActions ? "YOUR MIXES:" : profileUsername ? `${profileUsername}'S MIXES:` : "MIXES:"}
            </div>
            <div>{videos.length} TRACKS</div>
          </div>
          <div className="flex justify-between uppercase">
            <div>TOTAL DURATION:</div>
            <div>{totalDurationHours || calculateTotalDuration()} HOURS</div>
          </div>
          <button 
            type="button"
            onClick={handleFeelingLucky}
            className="uppercase mt-1 text-right cursor-pointer md:hover:text-gray-500 w-full" 
            style={{ transform: 'rotate(180deg)' }}
          >
            FEELING LUCKY?
          </button>
        </div>

        {/* Desktop menu - hidden on mobile */}
        <div className="mt-6 flex-col gap-1 text-sm font-bold tracking-[0.18em] hidden md:flex">
          <button
            type="button"
            onClick={toggleListView}
            className="text-gray-500 hover:text-black transition-colors text-left"
          >
            // {isListView ? "3D VIEW" : "LIST VIEW"}
          </button>
          {onCopyProfileUrl && (
            <button
              type="button"
              onClick={handleShare}
              className="text-gray-500 hover:text-black transition-colors text-left"
            >
              // {shareCopied ? "PROFILE LINK COPIED" : "COPY PROFILE LINK"}
            </button>
          )}
          {onSignOut && (
            <button
              type="button"
              onClick={onSignOut}
              className="text-gray-500 hover:text-black transition-colors text-left"
            >
              // SIGN OUT
            </button>
          )}
        </div>
      </div>

      {/* Mobile Menu Button - Bottom Left */}
      <button
        type="button"
        onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
        className={`
          fixed bottom-6 left-6 z-50
          flex flex-col justify-center items-center
          w-20 h-20
          transition-opacity duration-1000
          ${activeVideoId ? "opacity-0 pointer-events-none" : "opacity-100"}
          md:hidden
        `}
        aria-label="Toggle menu"
      >
        <span className="w-14 h-[10px] bg-black mb-2" />
        <span className="w-14 h-[10px] bg-black mb-2" />
        <span className="w-14 h-[10px] bg-black" />
      </button>

      {/* Mobile Menu Panel */}
      {isMobileMenuOpen && (
        <div
          className={`
            fixed bottom-24 left-6 z-50
            bg-black text-white
            p-4
            transition-opacity duration-300
            ${activeVideoId ? "opacity-0 pointer-events-none" : "opacity-100"}
            md:hidden
            ${ibmPlexMono.className}
          `}
        >
          <div className="flex flex-col gap-3 text-xs font-bold tracking-[0.18em]">
            <button
              type="button"
              onClick={() => {
                toggleListView();
                setIsMobileMenuOpen(false);
              }}
              className="text-white transition-colors text-left"
            >
              // {isListView ? "3D VIEW" : "LIST VIEW"}
            </button>
            {onCopyProfileUrl && (
              <button
                type="button"
                onClick={() => {
                  handleShare();
                  setIsMobileMenuOpen(false);
                }}
                className="text-white transition-colors text-left"
              >
                // {shareCopied ? "PROFILE LINK COPIED" : "COPY PROFILE LINK"}
              </button>
            )}
            {onSignOut && (
              <button
                type="button"
                onClick={() => {
                  onSignOut();
                  setIsMobileMenuOpen(false);
                }}
                className="text-white transition-colors text-left"
              >
                // SIGN OUT
              </button>
            )}
          </div>
        </div>
      )}
      

      {/* List view - shown when isListView is true and no video is playing */}
      {isListView && (
        <div className={`
          fixed 
          md:top-8 md:left-[35vw] md:right-8 md:max-h-[calc(100vh-4rem)]
          top-[280px] left-4 right-4 max-h-[calc(100vh-320px)]
          transition-opacity duration-1000 
          ${activeVideoId ? "z-0 opacity-0 pointer-events-none" : "z-40 opacity-100"} 
          ${ibmPlexMono.className}
          overflow-y-auto
        `}>
          <div>
            {videos.map((video, index) => (
              <div
                key={video.id || index}
                className="flex flex-col md:flex-row md:justify-between items-start md:items-center py-3 border-b border-gray-300 last:border-b-0 cursor-pointer md:hover:bg-gray-50 transition-colors"
                onClick={() => {
                  setExternalSelectVideoId(video.videoId);
                  setIsMobileMenuOpen(false);
                }}
              >
                <div className="text-left text-xs md:text-sm font-medium tracking-wide uppercase flex-1 pr-4 mb-1 md:mb-0">
                  {video.title}
                </div>
                <div className="text-left md:text-right text-xs md:text-sm font-medium tracking-wide uppercase text-gray-600">
                  {video.channelTitle}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state - shown when there are no videos */}
      {videos.length === 0 && !activeVideoId && (
        <div className="fixed inset-0 flex items-center justify-center z-30">
          <div className="relative">
            {/* Vinyl-shaped rectangle with dotted border */}
            <div 
              className="w-[400px] h-[300px] bg-transparent border-2 border-black"
              style={{
                borderStyle: 'dashed',
                borderWidth: '2px',
                borderRadius: '50%',
              }}
            >
              {/* Center text */}
              <div className="absolute inset-0 flex items-center justify-center">
                <p className={`text-black text-sm font-bold tracking-[0.18em] uppercase ${ibmPlexMono.className}`}>
                  ADD YOUR FIRST MIX
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VinylStack3D - always rendered, but hidden when in list view and no video is playing */}
      <div className="flex flex-col items-center">
        <div className={`mt-8 w-full lg:w-screen self-stretch max-w-none overflow-visible px-4 md:px-6 lg:px-10 xl:px-16 ${isListView && !activeVideoId ? 'opacity-0 pointer-events-none' : ''} ${videos.length === 0 ? 'opacity-0 pointer-events-none' : ''}`}>
          <VinylStack3D
            items={videos}
            onRequestPlay={onRequestPlay}
            onRequestToggle={onRequestToggle}
            onSeek={onSeek}
            isPlaying={isPlaying}
            currentTime={currentTime}
            clearSelectionKey={clearSelectionKey}
            onDelete={onDelete}
            externalSelectVideoId={externalSelectVideoId}
          />
        </div>
      </div>

      {/* Close button - always visible when there's an active video */}
      {activeVideoId && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center h-20 w-20">
          <button
            type="button"
            onClick={() => {
              requireMouseLeaveAfterClose();
              onCloseActive?.();
            }}
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
          onMouseLeave={handleMouseLeave}
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
              onClick={handleButtonClick}
              onMouseEnter={handleMouseEnter}
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

