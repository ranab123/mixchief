"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabaseClient";
import UsernameSetup from "./components/UsernameSetup";
import { getSiteUrl } from "@/lib/url";
import { ensureProfileExists, type UserProfile } from "@/lib/profile";

export default function Home() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);
  const hasRedirectedRef = useRef(false);
  const router = useRouter();

  useEffect(() => {
    async function loadUserData() {
      try {
        setAuthLoading(true);
        const { data: authData, error: authError } = await supabase.auth.getUser();

        if (authError) {
          if (authError.name === "AuthSessionMissingError") {
            setUser(null);
            setProfile(null);
            setAuthLoading(false);
            setProfileLoading(false);
            return;
          }
          throw authError;
        }

        if (!authData.user) {
          setUser(null);
          setProfile(null);
          setAuthLoading(false);
          setProfileLoading(false);
          return;
        }

        setUser(authData.user);
        setProfileLoading(true);

        const ensuredProfile = await ensureProfileExists(authData.user);
        if (ensuredProfile) {
          setProfile(ensuredProfile);
        } else {
          setProfile(null);
        }
      } catch (error) {
        console.error("Error during authentication:", error);
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
    router.push("/profile");
  }, [profile, user, router]);

  async function signIn() {
    const redirectUrl = getSiteUrl();
    console.log("🔍 Sign in redirect URL:", redirectUrl);
    console.log("🔍 Environment variables:", {
      NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
      NEXT_PUBLIC_VERCEL_URL: process.env.NEXT_PUBLIC_VERCEL_URL,
      windowOrigin: typeof window !== "undefined" ? window.location.origin : "N/A",
    });

    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: redirectUrl,
      },
    });
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
    } else if (error) {
      console.error("Error fetching profile after setup:", error);
    }
  }

  return (
    <main className="flex flex-col items-center justify-center min-h-screen py-8 relative">
      {authLoading ? (
        <div className="mt-8 flex flex-col items-center">
          <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin" />
          <p className="mt-2 text-sm text-gray-500">Loading...</p>
        </div>
      ) : !user ? (
        <button onClick={signIn} className="mt-4 p-2 bg-black text-white rounded">
          Sign in with Google
        </button>
      ) : profileLoading ? (
        <div className="mt-8 flex flex-col items-center">
          <div className="w-8 h-8 border-2 border-black border-t-transparent rounded-full animate-spin" />
          <p className="mt-2 text-sm text-gray-500">Loading profile...</p>
        </div>
      ) : !profile ? (
        <div className="mt-8">
          <UsernameSetup userId={user.id} userEmail={user.email || ""} onComplete={handleUsernameSetup} />
        </div>
      ) : (
        <div className="mt-8 text-sm text-gray-500 uppercase tracking-[0.18em]">
          Redirecting to your profile...
        </div>
      )}
    </main>
  );
}
