import { useEffect, useState, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface Collaborator {
  id: string;
  email: string;
  role: string;
  user_id: string | null;
  invited_at: string;
  joined_at: string | null;
}

export function useWorkspaceCollaborators(requestId: string) {
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [loading, setLoading] = useState(true);

  const fetch = useCallback(async () => {
    const { data } = await supabase
      .from("workspace_collaborators")
      .select("id, email, role, user_id, invited_at, joined_at")
      .eq("request_id", requestId) as any;
    setCollaborators((data as Collaborator[]) || []);
    setLoading(false);
  }, [requestId]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  return { collaborators, loading, refetch: fetch };
}
