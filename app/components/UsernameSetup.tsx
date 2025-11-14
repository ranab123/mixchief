"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";

interface UsernameSetupProps {
  userId: string;
  userEmail: string;
  onComplete: (username: string) => void;
}

export default function UsernameSetup({ userId, userEmail, onComplete }: UsernameSetupProps) {
  const [username, setUsername] = useState("");
  const [isAvailable, setIsAvailable] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Generate a suggested username from the email
  useEffect(() => {
    if (userEmail) {
      const suggestedUsername = userEmail.split('@')[0].replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
      setUsername(suggestedUsername);
    }
  }, [userEmail]);

  // Check username availability with debounce
  useEffect(() => {
    if (!username) {
      setIsAvailable(null);
      return;
    }

    const timer = setTimeout(async () => {
      if (username.length < 3) {
        setIsAvailable(false);
        setError("Username must be at least 3 characters");
        return;
      }

      if (!/^[a-zA-Z0-9_]+$/.test(username)) {
        setIsAvailable(false);
        setError("Username can only contain letters, numbers, and underscores");
        return;
      }

      setIsChecking(true);
      try {
        // Type assertion to handle the RPC call
        const { data, error } = await supabase.rpc('check_username_available', {
          username_to_check: username
        } as any);

        if (error) throw error;
        
        setIsAvailable(data);
        setError(data ? null : "Username is already taken");
      } catch (err: any) {
        console.error("Error checking username:", err);
        setError("Error checking username availability");
        setIsAvailable(false);
      } finally {
        setIsChecking(false);
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [username]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    if (!isAvailable || isChecking) return;
    
    try {
      // Type assertion to handle the insert
      const { error } = await supabase
        .from('profiles')
        .insert({
          id: userId,
          username: username,
          display_name: username
        } as any);

      if (error) throw error;
      
      onComplete(username);
    } catch (err: any) {
      console.error("Error saving username:", err);
      setError("Failed to save username. Please try again.");
    }
  }

  return (
    <div className="w-full max-w-md p-6 bg-white rounded-lg shadow-md">
      <h2 className="text-2xl font-bold mb-6 text-center">Choose a Username</h2>
      <p className="text-gray-600 mb-6 text-center">
        Pick a unique username for your DJ Crate profile
      </p>
      
      <form onSubmit={handleSubmit}>
        <div className="mb-4">
          <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
            Username
          </label>
          <input
            id="username"
            type="text"
            value={username}
            onChange={(e) => setUsername(e.target.value.trim())}
            className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-black focus:outline-none"
            placeholder="Choose a username"
            autoComplete="off"
          />
          
          <div className="mt-2 h-6">
            {isChecking ? (
              <p className="text-gray-500 text-sm">Checking availability...</p>
            ) : error ? (
              <p className="text-red-500 text-sm">{error}</p>
            ) : username && isAvailable ? (
              <p className="text-green-500 text-sm">Username is available!</p>
            ) : null}
          </div>
        </div>
        
        <button
          type="submit"
          disabled={!isAvailable || isChecking || !username}
          className={`w-full p-2 rounded text-white font-medium 
            ${isAvailable && !isChecking && username 
              ? "bg-black hover:bg-gray-800" 
              : "bg-gray-400 cursor-not-allowed"}`}
        >
          Continue
        </button>
      </form>
    </div>
  );
}
