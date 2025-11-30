import type { User } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";

export interface UserProfile {
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

export async function ensureProfileExists(user: User): Promise<UserProfile | null> {
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

