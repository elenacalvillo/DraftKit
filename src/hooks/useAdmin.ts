import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";

/**
 * Hook for checking admin status for UI control purposes.
 *
 * SECURITY NOTE: This is for UI visibility only (showing/hiding admin menu items).
 * All actual data access is protected by RLS policies on the backend.
 * Even if a user manipulates client state, they cannot access admin data.
 * The RPC call to has_role() validates permissions server-side.
 *
 * Implementation note: uses React Query so the result is shared/deduped across
 * every component that calls useAdmin(). Without this, each consumer fired its
 * own has_role RPC call on every render — a major source of the network storm.
 */
export function useAdmin() {
  const { user, loading: authLoading } = useAuth();

  const { data: isAdmin = false, isLoading } = useQuery({
    queryKey: ["isAdmin", user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data, error } = await supabase.rpc("has_role", {
        _user_id: user.id,
        _role: "admin",
      });
      if (error) {
        console.error("Error checking admin role:", error);
        return false;
      }
      return data === true;
    },
    // Circuit breaker: only run once auth is resolved AND we have a user.
    // Prevents the "fire as anon → RLS 403 → retry" loop.
    enabled: !!user && !authLoading,
    staleTime: 5 * 60 * 1000, // role rarely changes mid-session
  });

  return { isAdmin, loading: isLoading || authLoading };
}
