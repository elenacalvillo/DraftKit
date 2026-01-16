import { useAuth } from "./useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";

export function usePro() {
  const { user } = useAuth();

  const { data: isPro, isLoading } = useQuery({
    queryKey: ["isPro", user?.id],
    queryFn: async () => {
      if (!user?.id) return false;
      
      const { data, error } = await supabase.rpc("has_role", {
        _user_id: user.id,
        _role: "pro" as "admin" | "user", // Type will be updated after migration
      });
      
      if (error) {
        console.error("Error checking pro status:", error);
        return false;
      }
      
      return data ?? false;
    },
    enabled: !!user?.id,
  });

  return { isPro: isPro ?? false, isLoading };
}
