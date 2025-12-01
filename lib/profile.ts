import type { User } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";

export interface UserProfile {
  id: string;
  username: string;
  display_name: string | null;
}

/**
 * Fetches the caller's profile if it already exists.
 * New profiles are now created through the UsernameSetup flow so we
 * can explicitly collect a unique username for routing.
 */
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

    return profileData ?? null;
  } catch (error) {
    console.error("Error fetching profile:", error);
    return null;
  }
}

