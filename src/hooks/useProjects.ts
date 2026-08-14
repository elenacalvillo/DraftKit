import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { canCreateAnotherProject } from "@/lib/access";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

export type Project = Tables<"projects">;

interface CreateProjectInput {
  title: string;
  description?: string | null;
}

/**
 * Returns all projects (active + archived) owned by the current
 * creator, ordered by most-recently-updated first.
 */
export function useProjects() {
  const { creator } = useAuth();
  const creatorId = creator?.id;

  const projectsQuery = useQuery({
    queryKey: ["projects", creatorId],
    queryFn: async (): Promise<Project[]> => {
      if (!creatorId) return [];
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("creator_id", creatorId)
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Project[];
    },
    enabled: !!creatorId,
    staleTime: 60 * 1000,
  });

  const projects = projectsQuery.data ?? [];
  const activeProjects = projects.filter((p) => !p.is_archived);
  const archivedProjects = projects.filter((p) => p.is_archived);
  const activeCount = activeProjects.length;

  return {
    projects,
    activeProjects,
    archivedProjects,
    activeCount,
    canCreate: canCreateAnotherProject(activeCount),
    isLoading: projectsQuery.isLoading,
    error: projectsQuery.error,
    refetch: projectsQuery.refetch,
  };
}

export function useProject(projectId: string | undefined) {
  return useQuery({
    queryKey: ["project", projectId],
    queryFn: async (): Promise<Project | null> => {
      if (!projectId) return null;
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .eq("id", projectId)
        .maybeSingle();
      if (error) throw error;
      return (data as Project) ?? null;
    },
    enabled: !!projectId,
    staleTime: 60 * 1000,
  });
}

export function useCreateProject() {
  const { creator } = useAuth();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (input: CreateProjectInput) => {
      if (!creator?.id) throw new Error("Not authenticated");
      if (!input.title || !input.title.trim()) {
        throw new Error("Project title is required");
      }
      const payload: TablesInsert<"projects"> = {
        creator_id: creator.id,
        title: input.title.trim(),
        description: input.description?.trim() || null,
      };
      const { data, error } = await supabase
        .from("projects")
        .insert(payload)
        .select("*")
        .single();
      if (error) throw error;
      return data as Project;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useToggleProjectArchive() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, archive }: { id: string; archive: boolean }) => {
      const update: TablesUpdate<"projects"> = { is_archived: archive };
      const { data, error } = await supabase
        .from("projects")
        .update(update)
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw error;
      return data as Project;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useUpdateProject() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({
      id,
      title,
      description,
    }: {
      id: string;
      title: string;
      description?: string | null;
    }) => {
      if (!title.trim()) throw new Error("Project title is required");
      const update: TablesUpdate<"projects"> = {
        title: title.trim(),
        description: description?.trim() || null,
      };
      const { data, error } = await supabase
        .from("projects")
        .update(update)
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw error;
      return data as Project;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["project", data.id] });
    },
  });
}

export interface BookMetadataInput {
  id: string;
  author_name?: string | null;
  subtitle?: string | null;
  book_description?: string | null;
  isbn?: string | null;
  language?: string;
  cover_image_path?: string | null;
  cover_image_mime?: string | null;
  cover_image_bytes?: number | null;
}

/** Publication details used by the export pipeline (cover, ISBN, author…). */
export function useUpdateBookMetadata() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, ...fields }: BookMetadataInput) => {
      const update: TablesUpdate<"projects"> = {};
      (Object.keys(fields) as Array<keyof typeof fields>).forEach((key) => {
        const value = fields[key];
        if (key === "language") {
          const lang = typeof value === "string" ? value.trim() : "";
          if (lang) (update as Record<string, unknown>).language = lang;
          return;
        }
        if (value !== undefined) {
          (update as Record<string, unknown>)[key as string] =
            typeof value === "string" ? value.trim() || null : value;
        }
      });
      const { data, error } = await supabase
        .from("projects")
        .update(update)
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw error;
      return data as Project;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["projects"] });
      queryClient.invalidateQueries({ queryKey: ["project", data.id] });
    },
  });
}


