import { supabase } from "@/integrations/supabase/client";

/**
 * Shared host-side approve/decline logic used by Requests, Collaborations, and Workspace pages.
 * Keeps DB write + availability sync + email fan-out in one place so behavior can't drift.
 */

export interface ApproveArgs {
  requestId: string;
  creatorId: string;
  requestedDate: string | null;
}

export async function approveCollabRequest({ requestId, creatorId, requestedDate }: ApproveArgs) {
  const approvedAt = new Date().toISOString();

  const { error } = await supabase
    .from("collab_requests")
    .update({ status: "approved", approved_at: approvedAt })
    .eq("id", requestId);

  if (error) throw error;

  // Remove the date from availability
  if (requestedDate) {
    const { data: availData } = await supabase
      .from("availability")
      .select("*")
      .eq("creator_id", creatorId)
      .maybeSingle();

    if (availData) {
      await supabase
        .from("availability")
        .update({
          available_dates: (availData.available_dates || []).filter(
            (d: string) => d !== requestedDate
          ),
        })
        .eq("id", availData.id);
    }
  }

  // Fire-and-forget email notification
  supabase.functions
    .invoke("send-collab-email", { body: { type: "request_approved", requestId } })
    .catch((err) => console.error("Failed to send approval email:", err));

  return { approvedAt };
}

export async function declineCollabRequest(requestId: string) {
  const { error } = await supabase
    .from("collab_requests")
    .update({ status: "declined" })
    .eq("id", requestId);

  if (error) throw error;

  supabase.functions
    .invoke("send-collab-email", { body: { type: "request_declined", requestId } })
    .catch((err) => console.error("Failed to send decline email:", err));
}
