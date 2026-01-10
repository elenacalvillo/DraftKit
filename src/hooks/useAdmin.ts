import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

/**
 * Hook for checking admin status for UI control purposes.
 * 
 * SECURITY NOTE: This is for UI visibility only (showing/hiding admin menu items).
 * All actual data access is protected by RLS policies on the backend.
 * Even if a user manipulates client state, they cannot access admin data.
 * The RPC call to has_role() validates permissions server-side.
 */
export function useAdmin() {
  const { user, loading: authLoading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    
    if (!user) {
      setIsAdmin(false);
      setLoading(false);
      return;
    }

    checkAdminRole();
  }, [user, authLoading]);

  const checkAdminRole = async () => {
    try {
      const { data, error } = await supabase.rpc("has_role", {
        _user_id: user!.id,
        _role: "admin",
      });

      if (error) {
        console.error("Error checking admin role:", error);
        setIsAdmin(false);
      } else {
        setIsAdmin(data === true);
      }
    } catch (e) {
      console.error("Failed to check admin role:", e);
      setIsAdmin(false);
    } finally {
      setLoading(false);
    }
  };

  return { isAdmin, loading: loading || authLoading };
}
