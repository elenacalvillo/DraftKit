import { useEffect, useState } from "react";
import { useParams, useSearchParams, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Star, Send, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

export default function Retrospective() {
  const { collabId } = useParams<{ collabId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();

  const [collab, setCollab] = useState<{
    requester_name: string;
    requested_date: string | null;
    status: string;
    retro_rating: number | null;
    retro_notes: string | null;
    retro_completed_at: string | null;
    creators?: { name: string } | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [rating, setRating] = useState<number | null>(null);
  const [notes, setNotes] = useState("");
  const [collabAgain, setCollabAgain] = useState<boolean | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [alreadyDone, setAlreadyDone] = useState(false);

  // Pre-fill rating from URL
  useEffect(() => {
    const urlRating = searchParams.get("rating");
    if (urlRating) {
      const parsed = parseInt(urlRating, 10);
      if (parsed >= 1 && parsed <= 5) setRating(parsed);
    }
  }, [searchParams]);

  // Load collab details
  useEffect(() => {
    if (!collabId || authLoading) return;
    
    async function fetchCollab() {
      const { data, error } = await supabase
        .from("collab_requests")
        .select("requester_name, requested_date, status, retro_rating, retro_notes, retro_completed_at, creators(name)")
        .eq("id", collabId)
        .maybeSingle();

      if (error || !data) {
        toast.error("Couldn't find this collaboration.");
        navigate("/dashboard", { replace: true });
        return;
      }

      setCollab(data as any);

      if (data.retro_completed_at) {
        setAlreadyDone(true);
        setRating(data.retro_rating);
        setNotes(data.retro_notes || "");
      }

      setLoading(false);
    }

    fetchCollab();
  }, [collabId, authLoading]);

  const handleSubmit = async () => {
    if (!collabId || !rating) {
      toast.error("Please select a rating before submitting.");
      return;
    }

    setSubmitting(true);

    const retroNotes = [
      notes ? `Notes: ${notes}` : null,
      collabAgain !== null ? `Would collab again: ${collabAgain ? "Yes" : "No"}` : null,
    ].filter(Boolean).join(" | ");

    const { error } = await supabase
      .from("collab_requests")
      .update({
        retro_rating: rating,
        retro_notes: retroNotes || null,
        retro_completed_at: new Date().toISOString(),
      })
      .eq("id", collabId);

    if (error) {
      console.error("Retro save error:", error);
      toast.error("Something went wrong. Please try again.");
      setSubmitting(false);
      return;
    }

    toast.success("Thanks for the feedback! 🎉");
    navigate("/dashboard", { replace: true });
  };

  if (loading || authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  const creatorName = (collab?.creators as any)?.name || "your collaborator";
  const partnerName = collab?.requester_name || "your partner";
  const collabDate = collab?.requested_date
    ? new Date(collab.requested_date + "T12:00:00").toLocaleDateString("en-US", {
        weekday: "long",
        month: "long",
        day: "numeric",
      })
    : null;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg"
      >
        {/* Brand header */}
        <div className="text-center mb-8">
          <h2 className="text-2xl font-bold">
            <span style={{ color: "#2a2318" }}>Draft</span>
            <span style={{ color: "#e07b6c" }}>Kit</span>
          </h2>
          <p className="text-xs text-muted-foreground tracking-wide mt-1">
            The engine for creators who ship together
          </p>
        </div>

        <div className="glass-card p-8">
          {alreadyDone ? (
            <div className="text-center py-6">
              <CheckCircle2 className="w-16 h-16 text-emerald-500 mx-auto mb-4" />
              <h3 className="text-xl font-semibold mb-2">Already submitted!</h3>
              <p className="text-muted-foreground mb-6">
                You already shared your feedback for this collaboration. Thank you! 🙌
              </p>
              <Button onClick={() => navigate("/dashboard")} variant="outline">
                Go to Dashboard
              </Button>
            </div>
          ) : (
            <>
              <div className="text-center mb-6">
                <h1 className="text-xl font-bold mb-2">🎉 How Did It Go?</h1>
                {collabDate && (
                  <p className="text-sm text-muted-foreground">
                    Your collab with <strong>{partnerName}</strong> on {collabDate}
                  </p>
                )}
              </div>

              {/* Star Rating */}
              <div className="mb-8">
                <p className="text-sm font-medium mb-3 text-center">Rate this collaboration</p>
                <div className="flex justify-center gap-2">
                  {[1, 2, 3, 4, 5].map((value) => (
                    <button
                      key={value}
                      onClick={() => setRating(value)}
                      className="transition-transform hover:scale-110 focus:outline-none"
                    >
                      <Star
                        className={`w-10 h-10 transition-colors ${
                          rating && value <= rating
                            ? "fill-amber-400 text-amber-400"
                            : "text-muted-foreground/30"
                        }`}
                      />
                    </button>
                  ))}
                </div>
              </div>

              {/* Would collab again? */}
              <div className="mb-6">
                <p className="text-sm font-medium mb-3">Would you collaborate here again?</p>
                <div className="flex gap-3">
                  {[
                    { label: "Yes", value: true },
                    { label: "🔥 Definitely", value: true },
                    { label: "Not sure", value: false },
                  ].map((option) => (
                    <button
                      key={option.label}
                      onClick={() => setCollabAgain(option.value)}
                      className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors ${
                        collabAgain === option.value
                          ? "bg-primary text-primary-foreground border-primary"
                          : "bg-background border-border hover:bg-muted"
                      }`}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Notes */}
              <div className="mb-8">
                <p className="text-sm font-medium mb-2">Anything else? (optional)</p>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="What went well? What could be better?"
                  rows={3}
                  className="resize-none"
                />
              </div>

              {/* Submit */}
              <Button
                onClick={handleSubmit}
                disabled={!rating || submitting}
                className="w-full"
                variant="hero"
                size="lg"
              >
                {submitting ? (
                  "Submitting..."
                ) : (
                  <>
                    <Send className="w-4 h-4 mr-2" />
                    Submit Retrospective
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );
}
