import { useState, useRef, useEffect } from "react";
 import { useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MessageCircle, X, Send, Star, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { TurnstileWidget } from "@/components/turnstile/TurnstileWidget";
import { verifyTurnstileToken } from "@/lib/turnstile";

export function FeedbackWidget() {
  const { user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [securityError, setSecurityError] = useState<string | null>(null);
  const [rating, setRating] = useState<number>(0);
  const [hoveredRating, setHoveredRating] = useState<number>(0);
  const [feedbackType, setFeedbackType] = useState<string>("");
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const turnstileTokenRef = useRef<string | null>(null);

  // Keep ref in sync with state
  useEffect(() => {
    turnstileTokenRef.current = turnstileToken;
  }, [turnstileToken]);
 
   // Handle token from Turnstile
   const handleTurnstileVerify = useCallback((token: string) => {
     turnstileTokenRef.current = token;
     setTurnstileToken(token);
     setSecurityError(null);
   }, []);
 
   const handleTurnstileExpire = useCallback(() => {
     turnstileTokenRef.current = null;
     setTurnstileToken(null);
   }, []);
 
   // Immediate error when widget fails to load
   const handleTurnstileError = useCallback(() => {
     turnstileTokenRef.current = null;
     setTurnstileToken(null);
     const errorMsg = "Security check couldn't load. If you use an ad blocker or strict privacy mode, try disabling it or use another browser.";
     setSecurityError(errorMsg);
   }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSecurityError(null);

    if (!feedbackType || !message.trim()) {
      toast.error("Please select a type and enter your feedback");
      return;
    }

    // If token not ready yet, show verifying state and wait
    if (!turnstileTokenRef.current) {
      setIsVerifying(true);
      // Wait up to 10 seconds for the token
      const token = await new Promise<string | null>((resolve) => {
        let attempts = 0;
        const checkToken = setInterval(() => {
          attempts++;
          if (turnstileTokenRef.current) {
            clearInterval(checkToken);
            resolve(turnstileTokenRef.current);
          } else if (attempts >= 100) { // 10 seconds
            clearInterval(checkToken);
            resolve(null);
          }
        }, 100);
      });
      
      setIsVerifying(false);
      
      if (!token) {
        const errorMsg = "Security check took too long. If you're using a VPN or ad blocker, try disabling it temporarily.";
        setSecurityError(errorMsg);
        toast.error(errorMsg);
        return;
      }
    }

    setIsSubmitting(true);

    // Verify token with backend
    const verifyResult = await verifyTurnstileToken(turnstileTokenRef.current!);
    if (!verifyResult.success) {
       // Check for configuration issues vs user issues
       const isConfigError = verifyResult.codes?.some(c => 
         ['invalid-input-secret', 'invalid-input-response', 'bad-request'].includes(c)
       );
       const errorMsg = isConfigError
         ? "Security verification error. Please try again in a moment."
         : "Security check failed. Please refresh the page and try again.";
      setSecurityError(errorMsg);
      toast.error(errorMsg);
      setTurnstileToken(null);
      setIsSubmitting(false);
      return;
    }

    try {
      const feedbackEmail = email.trim() || user?.email || null;
      const pageUrl = window.location.pathname;

      const { error } = await supabase.from("user_feedback").insert({
        user_id: user?.id || null,
        email: feedbackEmail,
        rating: rating || null,
        feedback_type: feedbackType,
        message: message.trim(),
        page_url: pageUrl,
      });

      if (error) throw error;

      // Send email notification (fire and forget - don't block the user)
      supabase.functions.invoke("send-feedback-notification", {
        body: {
          feedbackType,
          message: message.trim(),
          rating: rating || null,
          email: feedbackEmail,
          pageUrl,
        },
      }).catch((err) => {
        console.error("Failed to send feedback notification:", err);
      });

      toast.success("Thank you for your feedback! 💜");
      setIsOpen(false);
      setRating(0);
      setFeedbackType("");
      setMessage("");
      setEmail("");
      setTurnstileToken(null);
      setSecurityError(null);
    } catch (e) {
      console.error("Failed to submit feedback:", e);
      toast.error("Failed to submit feedback. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    setTurnstileToken(null); // Reset token when closing
    setSecurityError(null);
  };

  return (
    <>
      {/* Floating button */}
      <motion.button
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ delay: 1, type: "spring" }}
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 z-50 w-14 h-14 rounded-full gradient-primary shadow-lg hover:shadow-xl transition-shadow flex items-center justify-center text-primary-foreground"
        aria-label="Give feedback"
      >
        <MessageCircle className="w-6 h-6" />
      </motion.button>

      {/* Modal */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleClose}
              className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50"
            />

            {/* Modal content */}
            <motion.div
              initial={{ opacity: 0, y: 100, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 100, scale: 0.95 }}
              className="fixed bottom-24 right-6 z-50 w-[360px] max-w-[calc(100vw-3rem)] glass-card p-6"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-lg">Send Feedback</h3>
                <button
                  onClick={handleClose}
                  className="p-1 rounded-lg hover:bg-muted transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {/* Rating */}
                <div>
                  <Label className="text-sm text-muted-foreground mb-2 block">
                    How's your experience? (optional)
                  </Label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        onMouseEnter={() => setHoveredRating(star)}
                        onMouseLeave={() => setHoveredRating(0)}
                        className="p-1 transition-transform hover:scale-110"
                      >
                        <Star
                          className={`w-6 h-6 ${
                            star <= (hoveredRating || rating)
                              ? "fill-accent text-accent"
                              : "text-muted-foreground"
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                {/* Feedback type */}
                <div>
                  <Label htmlFor="feedback-type">Type</Label>
                  <Select value={feedbackType} onValueChange={setFeedbackType}>
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select type..." />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="bug">🐛 Bug Report</SelectItem>
                      <SelectItem value="feature">✨ Feature Request</SelectItem>
                      <SelectItem value="general">💬 General Feedback</SelectItem>
                      <SelectItem value="praise">🎉 Praise</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Message */}
                <div>
                  <Label htmlFor="message">Your feedback</Label>
                  <Textarea
                    id="message"
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Tell us what's on your mind..."
                    rows={3}
                    className="mt-1 resize-none"
                    required
                  />
                </div>

                {/* Email (if not logged in) */}
                {!user && (
                  <div>
                    <Label htmlFor="email">Email (optional)</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="your@email.com"
                      className="mt-1"
                    />
                  </div>
                )}

                {/* Turnstile Widget (invisible) */}
                <TurnstileWidget
                 onVerify={handleTurnstileVerify}
                 onExpire={handleTurnstileExpire}
                 onError={handleTurnstileError}
                />

                {/* Inline Security Error */}
                {securityError && (
                  <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" />
                    {securityError}
                  </div>
                )}

                <Button
                  type="submit"
                  variant="gradient"
                  className="w-full"
                  disabled={isSubmitting || isVerifying}
                >
                  {isVerifying ? (
                    <>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full mr-2"
                      />
                     Verifying security...
                    </>
                  ) : isSubmitting ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full"
                    />
                  ) : (
                    <>
                      <Send className="w-4 h-4 mr-2" />
                      Send Feedback
                    </>
                  )}
                </Button>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
}
