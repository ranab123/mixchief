"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import { useParams } from "next/navigation";

interface Video {
  id: string;
  title: string;
  channel_title: string;
  duration: string;
  thumbnail_url: string;
  video_id: string;
  created_at: string;
}

interface Profile {
  id: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
}

export default function ProfilePage() {
  // Use the useParams hook to get the username parameter
  const params = useParams();
  const username = params.username as string;
  
  const [profile, setProfile] = useState<Profile | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [isOwnProfile, setIsOwnProfile] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  useEffect(() => {
    async function loadProfileData() {
      try {
        setLoading(true);
        
        // Get profile by username
        const { data: profileData, error: profileError } = await supabase
          .from("profiles")
          .select("*")
          .eq("username", username)
          .single() as {
            data: any;
            error: any;
          };
          
        if (profileError || !profileData) {
          setError("Profile not found");
          setLoading(false);
          return;
        }
        
        const typedProfile: Profile = {
          id: profileData.id,
          username: profileData.username,
          display_name: profileData.display_name,
          avatar_url: profileData.avatar_url
        };
        
        setProfile(typedProfile);
        
        // Get videos for this profile
        const { data: videosData, error: videosError } = await supabase
          .from("videos")
          .select("*")
          .eq("user_id", typedProfile.id)
          .order("created_at", { ascending: false }) as { 
            data: any[] | null; 
            error: any 
          };
          
        if (videosError) {
          console.error("Error loading videos:", videosError);
        } else {
          setVideos(videosData || []);
        }
        
        // Check if the current user is viewing their own profile
        const { data: { user } } = await supabase.auth.getUser();
        setIsOwnProfile(user?.id === typedProfile.id);
        
      } catch (err) {
        console.error("Error loading profile:", err);
        setError("Error loading profile");
      } finally {
        setLoading(false);
      }
    }
    
    loadProfileData();
  }, [username]);
  
  if (loading) {
    return (
      <div className="container mx-auto py-8 px-4 flex flex-col items-center justify-center min-h-screen">
        <div className="w-16 h-16 border-4 border-black border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-4 text-gray-600">Loading profile...</p>
      </div>
    );
  }
  
  if (error || !profile) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Link href="/" className="text-blue-600 hover:underline mb-4 inline-block">
          ← Back to Home
        </Link>
        <div className="mt-8 text-center">
          <h2 className="text-2xl font-bold text-red-500">Profile Not Found</h2>
          <p className="mt-2 text-gray-600">The profile you're looking for doesn't exist or has been removed.</p>
        </div>
      </div>
    );
  }
  
  return (
    <div className="container mx-auto py-8 px-4">
      <div className="mb-8">
        <Link href="/" className="text-blue-600 hover:underline mb-4 inline-block">
          ← Back to Home
        </Link>
        
        <div className="flex items-center gap-4 mt-4">
          <div className="w-16 h-16 bg-gray-200 rounded-full flex items-center justify-center">
            {profile.avatar_url ? (
              <img 
                src={profile.avatar_url} 
                alt={profile.username} 
                className="w-full h-full rounded-full object-cover"
              />
            ) : (
              <span className="text-2xl font-bold text-gray-500">
                {profile.username.charAt(0).toUpperCase()}
              </span>
            )}
          </div>
          
          <div>
            <h1 className="text-2xl font-bold">
              {profile.display_name || profile.username}
            </h1>
            <p className="text-gray-600">@{profile.username}</p>
            {isOwnProfile && (
              <p className="text-sm text-gray-500 mt-1">This is your profile</p>
            )}
          </div>
        </div>
      </div>
      
      <h2 className="text-xl font-bold mb-4">Videos</h2>
      
      {videos.length === 0 ? (
        <p className="text-gray-500">No videos yet.</p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {videos.map((video) => (
            <div key={video.id} className="bg-white rounded-lg shadow overflow-hidden">
              <a 
                href={`https://youtube.com/watch?v=${video.video_id}`} 
                target="_blank" 
                rel="noopener noreferrer"
                className="block"
              >
                <div className="aspect-video w-full overflow-hidden">
                  <img 
                    src={video.thumbnail_url} 
                    alt={video.title} 
                    className="w-full object-cover"
                  />
                </div>
                
                <div className="p-4">
                  <h3 className="font-bold line-clamp-2">{video.title}</h3>
                  <p className="text-gray-600 text-sm mt-1">{video.channel_title}</p>
                  <p className="text-gray-500 text-xs mt-1">Duration: {video.duration}</p>
                </div>
              </a>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
