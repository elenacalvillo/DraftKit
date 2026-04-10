 import { useEffect, useState, useRef, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ArrowLeft, ArrowRight, Calendar, Check, ChevronRight, ExternalLink, Sparkles, Mail, User, MessageSquare, Lightbulb, Loader2, AlertCircle, RefreshCw, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CollabCalendar } from "@/components/calendar/CollabCalendar";
import { supabase } from "@/integrations/supabase/client";
import { bookingFormSchema, COLLAB_TYPE_METADATA, COLLAB_MODE_METADATA, newsletterPublicationUrlSchema, type CollabStyle, type DateMeaning, type CollabMode } from "@/lib/validations";
import { normalizeSubstackUrl, isValidNewsletterPublicationUrl } from "@/lib/substack-url";
import { toast } from "sonner";
import { analyzeCollabMatch, type CollabSuggestion, type CollabMatchResult } from "@/lib/api/collab-match";
import { useAnalytics } from "@/hooks/useAnalytics";
import { useAuth } from "@/hooks/useAuth";
import { parseProfileTheme, getThemeStyles, type ProfileTheme } from "@/lib/theme-presets";
import { parseDateString, sanitizeSubstackImageUrl } from "@/lib/utils";
import { TurnstileWidget } from "@/components/turnstile/TurnstileWidget";
import { verifyTurnstileToken } from "@/lib/turnstile";

import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

interface Creator {
  id: string;
  username: string;
  name: string;
  substack_url: string | null;
  newsletter_url: string | null;
  welcome_message: string | null;
  profile_image_url: string | null;
  collab_style: string | null;
  collab_guidelines: string | null;
  date_meaning: DateMeaning | null;
  collab_mode: CollabMode | null;
  profile_theme: Record<string, unknown> | null;
}

interface Availability {
  available_dates: string[];
  blocked_dates: string[];
}

// Parse collab_style from DB (could be single value or JSON array)
const parseCollabStyles = (value: string | null): string[] => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [value];
  } catch {
    return [value];
  }
};

// Get date clarification text based on collab type and host's date meaning setting
const getDateClarification = (collabType: string | null, dateMeaning: DateMeaning | null): { icon: string; text: string } => {
  // If host has a specific date meaning set (not flexible), use that
  if (dateMeaning && dateMeaning !== 'flexible') {
    if (dateMeaning === 'kickoff') {
      return { icon: '🚀', text: 'This date is when we start working together' };
    } else if (dateMeaning === 'publish') {
      return { icon: '📅', text: 'This is the target publication date' };
    } else if (dateMeaning === 'live') {
      return { icon: '📞', text: 'This is the date of the call or event' };
    }
  }
  
  // Otherwise, use collab-type-specific text
  if (!collabType) return { icon: "📅", text: "Select a date for your collaboration" };
  
  const metadata = COLLAB_TYPE_METADATA[collabType as CollabStyle];
  if (metadata) {
    return { icon: metadata.icon, text: metadata.dateMeans };
  }
  
  return { icon: "📅", text: "This is your target collaboration date" };
};

// Get the calendar legend text based on date meaning
const getCalendarLegendText = (dateMeaning: DateMeaning | null): string => {
  if (!dateMeaning || dateMeaning === 'flexible') return 'Available';
  if (dateMeaning === 'kickoff') return 'Available to kick off';
  if (dateMeaning === 'publish') return 'Available to publish';
  if (dateMeaning === 'live') return 'Available for call/event';
  return 'Available';
};

export default function PublicBooking() {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();
  const { trackEvent } = useAnalytics();
  const { user } = useAuth();
  const hasTrackedPageView = useRef(false);
  
  const [creator, setCreator] = useState<Creator | null>(null);
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [bookedDates, setBookedDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isFlexibleDate, setIsFlexibleDate] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isAtCapacity, setIsAtCapacity] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Collab type selection
  const [availableCollabTypes, setAvailableCollabTypes] = useState<string[]>([]);
  const [selectedCollabType, setSelectedCollabType] = useState<string | null>(null);

  // SMART Match state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [matchResult, setMatchResult] = useState<CollabMatchResult | null>(null);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);
  const [analysisError, setAnalysisError] = useState<string | null>(null);
  const [selectedAiSuggestion, setSelectedAiSuggestion] = useState<CollabSuggestion | null>(null);

  // Turnstile state
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [securityError, setSecurityError] = useState<string | null>(null);
  const turnstileTokenRef = useRef<string | null>(null);

  // Keep ref in sync with state
  const handleTurnstileVerify = useCallback((token: string) => {
    turnstileTokenRef.current = token;
    setTurnstileToken(token);
    setSecurityError(null);
  }, []);

  const handleTurnstileExpireOrError = useCallback(() => {
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

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    substackUrl: "",
    message: "",
  });

  // Generate theme styles from creator's profile_theme
  const themeStyles = useMemo(() => {
    const theme = parseProfileTheme(creator?.profile_theme);
    return getThemeStyles(theme);
  }, [creator?.profile_theme]);

  // Track booking link clicked and store session start time
  useEffect(() => {
    if (!username || hasTrackedPageView.current) return;
    hasTrackedPageView.current = true;
    
    // Store session start time for duration tracking
    sessionStorage.setItem("booking_session_start", Date.now().toString());
    
    trackEvent("booking_link_clicked", { creator_username: username });
  }, [username, trackEvent]);

  useEffect(() => {
    if (!username) return;
    fetchCreatorData();
  }, [username]);

  // Pre-fill form for logged-in users with their creator profile from auth context
  // Note: We use the creator from useAuth() which queries the creators table with proper RLS
  // (auth.uid() = user_id), but for public data we use public_creator_profiles view
  const { creator: authCreator } = useAuth();
  
  useEffect(() => {
    if (!user || !authCreator) return;
    
    // Use the authenticated user's creator profile from auth context
    // Prefer newsletter_url for substackUrl (it's a publication URL, not profile)
    // Only use substack_url as fallback if it looks like a publication URL
    const preferredNewsletterUrl = authCreator.newsletter_url || 
      (authCreator.substack_url && isValidNewsletterPublicationUrl(authCreator.substack_url) 
        ? authCreator.substack_url 
        : '');
    
    setFormData(prev => ({
      ...prev,
      name: authCreator.name || prev.name,
      email: user.email || prev.email,
      substackUrl: preferredNewsletterUrl || prev.substackUrl,
    }));
  }, [user, authCreator]);

  const fetchCreatorData = async () => {
    if (!username) return;

    setIsLoading(true);

    // Fetch creator from public view (excludes sensitive data like email)
    const { data: creatorData, error } = await supabase
      .from('public_creator_profiles')
      .select('id, username, name, substack_url, newsletter_url, welcome_message, profile_image_url, collab_style, collab_guidelines, date_meaning, collab_mode, profile_theme')
      .eq('username', username)
      .maybeSingle();

    if (error || !creatorData) {
      setNotFound(true);
      setIsLoading(false);
      return;
    }

    const creatorObj: Creator = {
      ...creatorData,
      date_meaning: creatorData.date_meaning as DateMeaning | null,
      collab_mode: (creatorData.collab_mode || 'async') as CollabMode,
      profile_theme: creatorData.profile_theme as Record<string, unknown> | null,
    };
    setCreator(creatorObj);

    // Inject JSON-LD structured data for AI agents
    const jsonLd = {
      "@context": "https://schema.org",
      "@type": "Service",
      "name": `${creatorObj.name} — DraftKit`,
      "serviceType": "Newsletter Collaboration and Drafting",
      "description": "Infrastructure for Substack writers to cross the Coordination Chasm.",
      "provider": {
        "@type": "Person",
        "name": creatorObj.name,
        "url": `https://draftkit.app/${creatorObj.username}`
      },
      "additionalProperty": [
        { "@type": "PropertyValue", "name": "collaborationStatus", "value": "open" },
        { "@type": "PropertyValue", "name": "expertise", "value": "AI Product Management" },
        { "@type": "PropertyValue", "name": "shipRate", "value": "86%" }
      ]
    };
    const scriptTag = document.createElement("script");
    scriptTag.type = "application/ld+json";
    scriptTag.id = "draftkit-jsonld";
    scriptTag.textContent = JSON.stringify(jsonLd);
    // Remove any previous injection
    document.getElementById("draftkit-jsonld")?.remove();
    document.head.appendChild(scriptTag);
    
    // Parse collab styles
    const styles = parseCollabStyles(creatorData.collab_style);
    setAvailableCollabTypes(styles);
    // Auto-select if only one style available
    if (styles.length === 1) {
      setSelectedCollabType(styles[0]);
    }
    const { data: availData } = await supabase
      .from('availability')
      .select('available_dates, blocked_dates')
      .eq('creator_id', creatorData.id)
      .maybeSingle();

    if (availData) {
      setAvailability({
        available_dates: availData.available_dates || [],
        blocked_dates: availData.blocked_dates || [],
      });
    }

    // Fetch booked dates from public view (accessible to anonymous users)
    await fetchBookedDates(creatorData.id);

    // Check host capacity (free users have limited host spots)
    try {
      const { data: capData } = await supabase.rpc("get_host_capacity", { _creator_id: creatorData.id });
      if (capData) {
        const cap = capData as any;
        const limit = (cap.base_limit || 3) + (cap.referral_bonus || 0);
        const used = cap.used || 0;
        const isPro = cap.is_pro === true;
        if (!isPro && used >= limit) {
          setIsAtCapacity(true);
        }
      }
    } catch (e) {
      console.log("Could not check host capacity:", e);
    }

    setIsLoading(false);

    // Subscribe to real-time updates for collab_requests
    const channel = supabase
      .channel('public-booked-dates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'collab_requests',
          filter: `creator_id=eq.${creatorData.id}`,
        },
        () => {
          // Refetch booked dates when requests change
          fetchBookedDates(creatorData.id);
        }
      )
      .subscribe();

    // Cleanup subscription on unmount
    return () => {
      supabase.removeChannel(channel);
    };
  };

  const fetchBookedDates = async (creatorId: string) => {
    const { data: reqData } = await supabase
      .from('public_booked_dates')
      .select('requested_date')
      .eq('creator_id', creatorId);

    if (reqData) {
      setBookedDates(reqData.map((r) => r.requested_date).filter(Boolean) as string[]);
    }
  };

  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
  };

  const handleAnalyzeMatch = async () => {
    // Clear previous error state
    setAnalysisError(null);
    
    // Use newsletter_url for AI analysis (falls back to substack_url if not set)
    const creatorNewsletterUrl = creator?.newsletter_url || creator?.substack_url;
    if (!formData.substackUrl || !creatorNewsletterUrl) {
      const errorMsg = !formData.substackUrl 
        ? "Please enter your newsletter URL first"
        : "This creator hasn't linked their newsletter yet";
      setAnalysisError(errorMsg);
      toast.error(errorMsg);
      return;
    }

    // Validate with stricter schema that rejects profile URLs
    const validationResult = newsletterPublicationUrlSchema.safeParse(formData.substackUrl);
    
    if (!validationResult.success) {
      const errorMsg = validationResult.error.errors[0]?.message || "Please enter a valid newsletter URL";
      setAnalysisError(errorMsg);
      toast.error(errorMsg);
      return;
    }

    // Normalize the Substack URL (handles mobile share links, etc.)
    const normalizedResult = normalizeSubstackUrl(formData.substackUrl);
    
    if (!normalizedResult.isValid || !normalizedResult.normalized) {
      setAnalysisError(normalizedResult.error || "Please enter a valid Substack URL (e.g., yourname.substack.com)");
      toast.error(normalizedResult.error || "Please enter a valid Substack URL");
      return;
    }

    console.log(`Normalized Substack URL: ${formData.substackUrl} → ${normalizedResult.normalized}`);

    setIsAnalyzing(true);
    setMatchResult(null);

    // Track AI match analysis invoked
    trackEvent("analyze_collab_match_invoked", {
      creator_username: username,
      visitor_url: normalizedResult.normalized,
    });

    try {
      const result = await analyzeCollabMatch(creatorNewsletterUrl!, normalizedResult.normalized);
      
      // Handle empty suggestions case
      if (!result.suggestions || result.suggestions.length === 0) {
        setAnalysisError("No collaboration ideas found yet. This can happen if there's not enough content overlap between your newsletters. Try again later or proceed with your own idea!");
        setHasAnalyzed(true);
        return;
      }
      
      setMatchResult(result);
      setHasAnalyzed(true);
      toast.success("Found collaboration ideas!");
    } catch (error) {
      console.error("Analysis error:", error);
      const errorMessage = error instanceof Error ? error.message : "Failed to analyze match";
      
      // Provide more helpful error messages
      let userFriendlyError = errorMessage;
      if (errorMessage.includes("rate limit") || errorMessage.includes("Rate limit")) {
        userFriendlyError = "Too many requests. Please wait a moment and try again.";
      } else if (errorMessage.includes("RSS") || errorMessage.includes("feed")) {
        userFriendlyError = "Couldn't access your newsletter feed. Make sure your Substack URL is correct and your newsletter is public.";
      } else if (errorMessage.includes("No posts") || errorMessage.includes("no posts")) {
        userFriendlyError = "Your newsletter doesn't have enough published posts yet for content analysis.";
      }
      
      setAnalysisError(userFriendlyError);
      toast.error(userFriendlyError);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleUseSuggestion = (suggestion: CollabSuggestion) => {
    // Track AI suggestion selection
    trackEvent("ai_match_suggestion_selected", {
      topic: suggestion.topic,
      format: suggestion.format,
      creator_username: username,
    });
    
    // Store the selected suggestion so it can be included in the request
    setSelectedAiSuggestion(suggestion);
    
    const newMessage = `I'd love to collaborate on: "${suggestion.topic}"\n\n${suggestion.description}\n\nFormat: ${suggestion.format}`;
    setFormData({ ...formData, message: newMessage });
    toast.success("Suggestion added to your message!");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!selectedDate && !isFlexibleDate) || !username || !creator) return;
    
    // Clear security error on new attempt
    setSecurityError(null);
    
    // Require collab type selection if multiple available
    if (availableCollabTypes.length > 1 && !selectedCollabType) {
      setErrors(prev => ({ ...prev, collabType: "Please select a collaboration type" }));
      return;
    }

    setErrors({});

    // Validate inputs
    const result = bookingFormSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        const field = err.path[0] as string;
        fieldErrors[field] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setIsSubmitting(true);

    // Wait for turnstile token if not ready yet (invisible mode may still be processing)
    let token = turnstileTokenRef.current;
    if (!token) {
      setIsVerifying(true);
      const maxWait = 10000;
      const interval = 100;
      let waited = 0;
      while (!turnstileTokenRef.current && waited < maxWait) {
        await new Promise(r => setTimeout(r, interval));
        waited += interval;
      }
      token = turnstileTokenRef.current;
      setIsVerifying(false);
      
      if (!token) {
        const errorMsg = "Security check took too long. If you're using a VPN or ad blocker, try disabling it temporarily.";
        setSecurityError(errorMsg);
        toast.error(errorMsg);
        setIsSubmitting(false);
        return;
      }
    }

    const verifyResult = await verifyTurnstileToken(token);
    if (!verifyResult.success) {
       // Check for configuration issues vs user issues
       const isConfigError = verifyResult.codes?.some(c => 
         ['invalid-input-secret', 'invalid-input-response', 'bad-request'].includes(c)
       );
       const errorMsg = isConfigError
         ? "Security verification error. Please try again in a moment."
         : "Security check failed. Please refresh the page and try again. If the issue persists, try a different browser.";
      setSecurityError(errorMsg);
      toast.error(errorMsg);
      handleTurnstileExpireOrError();
      setIsSubmitting(false);
      return;
    }

    // Normalize the newsletter URL before storing (ensures canonical format)
    const normalizedUrl = normalizeSubstackUrl(formData.substackUrl.trim());
    const normalizedSubstackUrl = normalizedUrl.normalized || formData.substackUrl.trim();

    // Check if date is still available using public view (only if specific date selected)
    if (selectedDate && !isFlexibleDate) {
      const { data: existingRequest } = await supabase
        .from('public_booked_dates')
        .select('requested_date')
        .eq('creator_id', creator.id)
        .eq('requested_date', selectedDate)
        .maybeSingle();

      if (existingRequest) {
        toast.error("This date has just been booked. Please select another date.");
        setSelectedDate(null);
        setIsSubmitting(false);
        return;
      }
    }

    // Fetch requester's Substack profile image
    let requesterProfileImageUrl: string | null = null;
    try {
      const { data: profileData, error: profileError } = await supabase.functions.invoke(
        "fetch-substack-profile",
        { body: { substackUrl: formData.substackUrl.trim() } }
      );
      
      if (!profileError && profileData?.imageUrl) {
        requesterProfileImageUrl = sanitizeSubstackImageUrl(profileData.imageUrl);
      }
    } catch (e) {
      // Continue without profile image - it's not critical
      console.log("Could not fetch requester profile image:", e);
    }

    // Account Blind: always submit as guest. Reconciliation happens via email matching
    // when the user eventually signs up (link_requests_to_new_user trigger).
    // Insert without returning row data to avoid SELECT RLS conflicts (Account Blindness hotfix)
    const { error } = await supabase
      .from('collab_requests')
      .insert({
        creator_id: creator.id,
        requester_name: formData.name.trim(),
        requester_email: formData.email.trim(),
        requester_substack_url: normalizedSubstackUrl,
        requester_profile_image_url: requesterProfileImageUrl,
        message: formData.message.trim() || null,
        requested_date: isFlexibleDate ? null : selectedDate,
        status: 'pending' as const,
        requester_user_id: user?.id ?? null,
        selected_collab_type: selectedCollabType,
        ai_suggestion_used: selectedAiSuggestion ? {
          topic: selectedAiSuggestion.topic,
          format: selectedAiSuggestion.format,
          description: selectedAiSuggestion.description,
        } : null,
      });

    if (error) {
      const { data: sessionData } = await supabase.auth.getSession();
      console.error("Collab request insert error:", JSON.stringify({
        step: 'insert_without_returning',
        code: error.code,
        message: error.message,
        details: error.details,
        hint: error.hint,
        auth_state_summary: {
          hasSession: !!sessionData?.session,
          authUserId: sessionData?.session?.user?.id ?? null,
        },
        payload: {
          creator_id: creator.id,
          requester_email: formData.email.trim(),
          requester_user_id: user?.id ?? null,
          selected_collab_type: selectedCollabType,
          requested_date: isFlexibleDate ? null : selectedDate,
        },
      }));
      // Handle unique constraint violation (race condition - date was just booked)
      if (error.code === '23505') {
        toast.error("This date has just been booked. Please select another date.");
        setSelectedDate(null);
      } else {
        toast.error("Failed to submit request. Please try again.");
      }
      setIsSubmitting(false);
      return;
    }

    // Email notifications are handled by the on_new_collab_request database trigger,
    // which calls send-collab-email via pg_net after insert.

    setIsSubmitting(false);
    setIsSuccess(true);
    toast.success("Request sent successfully!");
    
    // Calculate session duration
    const sessionStart = sessionStorage.getItem("booking_session_start");
    const sessionDurationMs = sessionStart ? Date.now() - parseInt(sessionStart) : null;
    
    // Detect if user used an AI suggestion (message contains the AI-generated format)
    const usedAiSuggestion = hasAnalyzed && formData.message.includes("I'd love to collaborate on:");
    
    // Track booking submitted with enhanced data
    trackEvent("booking_submitted", { 
      creator_username: username,
      has_date: !isFlexibleDate && !!selectedDate,
      used_ai_suggestion: usedAiSuggestion,
      session_duration_ms: sessionDurationMs,
    });
  };

  const formatSelectedDate = (dateStr: string) => {
    const date = parseDateString(dateStr);
    return date.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  };

  if (isLoading) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
          className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full"
        />
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card p-12 text-center max-w-md"
        >
          <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-6 flex items-center justify-center">
            <User className="w-8 h-8 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-bold mb-2">Creator Not Found</h1>
          <p className="text-muted-foreground mb-6">
            The creator you're looking for doesn't exist or has been removed.
          </p>
          <Button variant="gradient" asChild>
            <Link to="/">Go to Homepage</Link>
          </Button>
        </motion.div>
      </div>
    );
  }

  if (!creator) {
    return null;
  }

  // Host is at capacity — show friendly message instead of booking form
  if (isAtCapacity) {
    return (
      <div className="min-h-screen gradient-bg flex items-center justify-center p-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card p-12 text-center max-w-md"
        >
          <div className="w-16 h-16 rounded-full bg-muted mx-auto mb-6 flex items-center justify-center">
            <AlertCircle className="w-8 h-8 text-muted-foreground" />
          </div>
          <h1 className="text-2xl font-bold mb-2">At Capacity</h1>
          <p className="text-muted-foreground mb-4">
            {creator.name} has reached the limit for incoming requests right now. Please check back later or reach out on Substack to coordinate.
          </p>
          {creator.substack_url && (
            <Button variant="outline" asChild className="mb-3">
              <a href={creator.substack_url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4 mr-2" />
                Visit on Substack
              </a>
            </Button>
          )}
          <div>
            <Link
              to="/"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              ← Back to DraftKit
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  return (
    <div 
      className="min-h-screen"
      style={{
        ...themeStyles,
        background: `var(--theme-gradient, linear-gradient(135deg, hsl(12 76% 61%), hsl(16 65% 45%)))`,
      }}
    >
      {/* Background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{
            scale: [1, 1.1, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute top-1/4 -right-1/4 w-1/2 h-1/2 rounded-full blur-3xl"
          style={{ background: `radial-gradient(circle, hsla(var(--theme-primary, 12 76% 61%) / 0.3), transparent)` }}
        />
        <motion.div
          animate={{
            scale: [1.1, 1, 1.1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{
            duration: 12,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute -bottom-1/4 -left-1/4 w-1/2 h-1/2 rounded-full blur-3xl"
          style={{ background: `radial-gradient(circle, hsla(var(--theme-secondary, 16 65% 45%) / 0.3), transparent)` }}
        />
      </div>

      <div className="relative z-10 max-w-4xl mx-auto px-6 py-12">
        {/* Back button */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          className="mb-8"
        >
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">Back to DraftKit</span>
          </Link>
        </motion.div>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          {creator.profile_image_url ? (
            <img 
              src={creator.profile_image_url} 
              alt={creator.name}
              className="w-20 h-20 rounded-full mx-auto mb-4 object-cover ring-4 ring-white/20"
              style={{ 
                boxShadow: `0 0 30px hsla(var(--theme-glow, 12 76% 61%) / 0.4)`,
              }}
            />
          ) : (
            <div 
              className="w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center"
              style={{ 
                background: `var(--theme-gradient)`,
                boxShadow: `0 0 30px hsla(var(--theme-glow, 12 76% 61%) / 0.4)`,
              }}
            >
              <span className="text-3xl font-bold text-white">
                {creator.name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <h1 className="text-4xl font-bold mb-3">{creator.name}</h1>
          
          {/* Badge + Substack Link Row */}
          <div className="flex items-center justify-center gap-4 mb-4">
            {/* Mode Badge */}
            {creator.collab_mode && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 border border-primary/20 rounded-full cursor-help">
                      <span className="text-lg">{COLLAB_MODE_METADATA[creator.collab_mode].icon}</span>
                      <span className="font-medium text-primary">{COLLAB_MODE_METADATA[creator.collab_mode].badge}</span>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p className="text-sm max-w-[250px]">{COLLAB_MODE_METADATA[creator.collab_mode].badgeTooltip}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {/* Separator dot (only if both badge and link exist) */}
            {creator.collab_mode && creator.substack_url && (
              <span className="text-muted-foreground/50">•</span>
            )}

            {creator.substack_url && (
              <a
                href={creator.substack_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 text-primary hover:underline"
              >
                <ExternalLink className="w-4 h-4" />
                View Substack
              </a>
            )}
          </div>
          {creator.welcome_message && (
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto mb-6">
              {creator.welcome_message}
            </p>
          )}

          {/* Process Steps - only show when not in success state and not filling form */}
          {!isSuccess && !selectedDate && !isFlexibleDate && creator.collab_mode && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="max-w-md mx-auto mb-8"
            >
              {/* Personal headline for process */}
              <h4 className="text-sm font-semibold text-foreground text-center mb-4">
                My collaboration process
              </h4>
              <div className="flex items-center justify-center gap-4">
                {COLLAB_MODE_METADATA[creator.collab_mode].processSteps.map((step, index) => (
                  <div key={step.step} className="flex items-center">
                    <div className="flex flex-col items-center">
                      <div className="w-8 h-8 rounded-full bg-card border border-border flex items-center justify-center">
                        <span className="text-xs font-semibold text-primary">{step.step}</span>
                      </div>
                      <span className="text-xs text-muted-foreground mt-1.5 whitespace-nowrap">{step.label}</span>
                    </div>
                    {index < COLLAB_MODE_METADATA[creator.collab_mode!].processSteps.length - 1 && (
                      <ChevronRight className="w-4 h-4 text-muted-foreground/40 mx-1 mb-4" />
                    )}
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Collaboration Types with Outcomes */}
          {availableCollabTypes.length === 1 && (
            <div className="max-w-md mx-auto p-4 bg-accent/20 border border-accent/30 rounded-xl text-left">
              <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">{COLLAB_TYPE_METADATA[availableCollabTypes[0] as CollabStyle]?.icon || '📝'}</span>
                <div>
                  <p className="font-semibold text-primary">{availableCollabTypes[0]}</p>
                  <p className="text-sm text-muted-foreground">
                    {COLLAB_TYPE_METADATA[availableCollabTypes[0] as CollabStyle]?.outcome || 'Collaboration'}
                  </p>
                </div>
              </div>
            </div>
          )}
          {availableCollabTypes.length > 1 && (
            <div className="max-w-lg mx-auto">
              <p className="text-sm text-muted-foreground mb-3">Open to collaborating on:</p>
              <div className="flex flex-wrap gap-2 justify-center">
                {availableCollabTypes.map((style) => (
                  <span 
                    key={style}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-primary/10 rounded-full text-sm"
                  >
                    <span>{COLLAB_TYPE_METADATA[style as CollabStyle]?.icon || '📝'}</span>
                    <span className="text-primary font-medium">{style}</span>
                  </span>
                ))}
              </div>
            </div>
          )}
        </motion.div>

        {/* Main card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card p-8"
        >
          <AnimatePresence mode="wait">
            {isSuccess ? (
              <motion.div
                key="success"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="text-center py-12"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", duration: 0.5 }}
                  className="w-20 h-20 rounded-full bg-success/20 mx-auto mb-6 flex items-center justify-center"
                >
                  <Check className="w-10 h-10 text-success" />
                </motion.div>
                <h2 className="text-2xl font-bold mb-2">Request Sent!</h2>
                <p className="text-sm text-muted-foreground mb-4">Sent to {creator.name}</p>
                
                {/* Date with meaning */}
                {selectedDate && !isFlexibleDate ? (
                  <div className="mb-4 p-4 bg-primary/5 border border-primary/20 rounded-xl max-w-md mx-auto">
                    <div className="flex items-center justify-center gap-2 mb-1">
                      <Calendar className="w-4 h-4 text-primary" />
                      <span className="font-medium">{formatSelectedDate(selectedDate)}</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {creator.collab_mode === 'discovery' 
                        ? 'Requested intro call time' 
                        : creator.date_meaning === 'publish' 
                          ? 'Target publication date'
                          : creator.date_meaning === 'kickoff'
                            ? 'Kickoff date'
                            : 'Requested collaboration date'}
                    </p>
                  </div>
                ) : (
                  <div className="mb-4 p-4 bg-muted/50 rounded-xl max-w-md mx-auto">
                    <p className="text-sm text-muted-foreground">Timing: Flexible — {creator.name} will suggest dates</p>
                  </div>
                )}
                
                {/* What happens next */}
                <div className="mb-6 max-w-md mx-auto text-left">
                  <h3 className="text-sm font-semibold text-center mb-3">What happens next</h3>
                  <div className="space-y-2 text-sm text-muted-foreground">
                    <div className="flex items-start gap-2">
                      <Mail className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                      <span>{creator.name} will receive your request and review it</span>
                    </div>
                    <div className="flex items-start gap-2">
                      <ArrowRight className="w-4 h-4 mt-0.5 text-primary shrink-0" />
                      <span>
                        {creator.collab_mode === 'discovery' 
                          ? 'If accepted, you\'ll receive a calendar invite for your intro call'
                          : 'If accepted, you\'ll receive an email with next steps for drafting'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Account creation CTA */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="mt-8 p-6 rounded-xl bg-primary/5 border border-primary/20 max-w-md mx-auto"
                >
                  <div className="flex items-center justify-center gap-2 mb-3">
                    <Sparkles className="w-5 h-5 text-primary" />
                    <h3 className="font-semibold">Want to track this collaboration?</h3>
                  </div>
                  <p className="text-sm text-muted-foreground mb-4">
                    Create your free DraftKit account to track all your requests, 
                    get notified of responses, and receive collaborations from other creators.
                  </p>
                  <div className="flex flex-col sm:flex-row gap-3 justify-center">
                    <Button
                      onClick={() => {
                        const params = new URLSearchParams({
                          email: formData.email,
                          name: formData.name,
                          substack: formData.substackUrl || '',
                        });
                        navigate(`/signup?${params.toString()}`);
                      }}
                      className="gradient-primary w-full sm:w-auto"
                    >
                      Create Account
                      <ArrowRight className="w-4 h-4 ml-2" />
                    </Button>
                    <Button
                      variant="ghost"
                      className="w-full sm:w-auto"
                      onClick={() => {
                        setIsSuccess(false);
                        setSelectedDate(null);
                        setIsFlexibleDate(false);
                        setFormData({ name: "", email: "", substackUrl: "", message: "" });
                        setMatchResult(null);
                        setHasAnalyzed(false);
                        setAnalysisError(null);
                      }}
                    >
                      Maybe Later
                    </Button>
                  </div>
                </motion.div>
              </motion.div>
            ) : selectedDate || isFlexibleDate ? (
              <motion.div
                key="form"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <button
                  onClick={() => {
                    setSelectedDate(null);
                    setIsFlexibleDate(false);
                  }}
                  className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-6 transition-colors"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back to calendar
                </button>

                {/* What You're Booking Summary */}
                <div className="mb-8 p-5 bg-gradient-to-br from-primary/5 to-accent/10 border border-primary/20 rounded-2xl">
                  <h3 className="text-sm font-semibold text-primary mb-3 flex items-center gap-2">
                    <Check className="w-4 h-4" />
                    What You're Booking
                  </h3>
                  <div className="space-y-3">
                    {/* Date */}
                    <div className="flex items-start gap-3">
                      <Calendar className="w-5 h-5 text-muted-foreground mt-0.5" />
                      <div>
                        <p className="font-medium">
                          {isFlexibleDate ? "Flexible timing" : formatSelectedDate(selectedDate!)}
                        </p>
                        {!isFlexibleDate && (
                          <p className="text-sm text-muted-foreground">
                            {selectedCollabType 
                              ? getDateClarification(selectedCollabType, creator.date_meaning).text
                              : creator.date_meaning === 'publish' ? 'Target publication date'
                              : creator.date_meaning === 'live' ? 'Date for your call/event'
                              : creator.date_meaning === 'kickoff' ? 'Day to start working together'
                              : 'Your collaboration date'}
                          </p>
                        )}
                      </div>
                    </div>
                    
                    {/* Collab Type (if single) */}
                    {availableCollabTypes.length === 1 && (
                      <div className="flex items-start gap-3">
                        <span className="text-xl mt-0.5">{COLLAB_TYPE_METADATA[availableCollabTypes[0] as CollabStyle]?.icon || '📝'}</span>
                        <div>
                          <p className="font-medium">{availableCollabTypes[0]}</p>
                          <p className="text-sm text-muted-foreground">
                            → {COLLAB_TYPE_METADATA[availableCollabTypes[0] as CollabStyle]?.outcome || 'Collaboration'}
                          </p>
                        </div>
                      </div>
                    )}
                    
                    {/* Selected Collab Type (if multiple and selected) */}
                    {availableCollabTypes.length > 1 && selectedCollabType && (
                      <div className="flex items-start gap-3">
                        <span className="text-xl mt-0.5">{COLLAB_TYPE_METADATA[selectedCollabType as CollabStyle]?.icon || '📝'}</span>
                        <div>
                          <p className="font-medium">{selectedCollabType}</p>
                          <p className="text-sm text-muted-foreground">
                            → {COLLAB_TYPE_METADATA[selectedCollabType as CollabStyle]?.outcome || 'Collaboration'}
                          </p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* Collab Type Selection - Only show if creator has multiple types */}
                {availableCollabTypes.length > 1 && (
                  <div className="mb-6 space-y-3">
                    <Label className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4" />
                      What type of collaboration? <span className="text-destructive">*</span>
                    </Label>
                    <div className="grid gap-3">
                      {availableCollabTypes.map((style) => {
                        const metadata = COLLAB_TYPE_METADATA[style as CollabStyle];
                        return (
                          <div
                            key={style}
                            className={`flex items-start gap-3 p-4 rounded-xl border cursor-pointer transition-all ${
                              selectedCollabType === style
                                ? "bg-primary/10 border-primary/50 shadow-sm"
                                : "bg-muted/30 border-transparent hover:border-muted-foreground/20"
                            }`}
                            onClick={() => {
                              setSelectedCollabType(style);
                              setErrors(prev => ({ ...prev, collabType: "" }));
                            }}
                          >
                            <div 
                              className={`w-5 h-5 mt-0.5 rounded-full border-2 flex-shrink-0 flex items-center justify-center ${
                                selectedCollabType === style 
                                  ? "border-primary bg-primary" 
                                  : "border-muted-foreground/40"
                              }`}
                            >
                              {selectedCollabType === style && (
                                <Check className="w-3 h-3 text-primary-foreground" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-lg">{metadata?.icon || '📝'}</span>
                                <p className="font-medium">{style}</p>
                              </div>
                              <p className="text-sm text-muted-foreground mb-2">
                                → {metadata?.outcome || 'See guidelines'}
                              </p>
                              {!isFlexibleDate && (
                                <p className="text-xs text-muted-foreground/80 bg-muted/50 px-2 py-1 rounded inline-block">
                                  📅 {metadata?.dateMeans || 'Collaboration date'}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {errors.collabType && (
                      <p className="text-sm text-destructive">{errors.collabType}</p>
                    )}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-6">
                  <div className="grid md:grid-cols-2 gap-6">
                    <div className="space-y-2">
                      <Label htmlFor="name" className="flex items-center gap-2">
                        <User className="w-4 h-4" />
                        Your Name
                      </Label>
                      <Input
                        id="name"
                        required
                        value={formData.name}
                        onChange={(e) =>
                          setFormData({ ...formData, name: e.target.value })
                        }
                        placeholder="John Doe"
                        className="h-12"
                      />
                      {errors.name && (
                        <p className="text-sm text-destructive">{errors.name}</p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="email" className="flex items-center gap-2">
                        <Mail className="w-4 h-4" />
                        Email
                      </Label>
                      <Input
                        id="email"
                        type="email"
                        required
                        value={formData.email}
                        onChange={(e) =>
                          setFormData({ ...formData, email: e.target.value })
                        }
                        placeholder="john@example.com"
                        className="h-12"
                      />
                      {errors.email && (
                        <p className="text-sm text-destructive">{errors.email}</p>
                      )}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="substackUrl" className="flex items-center gap-2">
                      <ExternalLink className="w-4 h-4" />
                      Your Newsletter URL <span className="text-destructive">*</span>
                    </Label>
                    <div className="flex flex-wrap gap-2">
                      <Input
                        id="substackUrl"
                        type="text"
                        required
                        value={formData.substackUrl}
                      onChange={(e) => {
                          setFormData({ ...formData, substackUrl: e.target.value });
                          // Reset analysis when URL changes
                          if (hasAnalyzed || analysisError) {
                            setMatchResult(null);
                            setHasAnalyzed(false);
                            setAnalysisError(null);
                          }
                        }}
                        placeholder="yourname.substack.com"
                        className="h-12 flex-1 min-w-0 w-full"
                      />
                      {(creator.newsletter_url || creator.substack_url) && (
                        <div className="relative group">
                          <Button
                            type="button"
                            variant="outline"
                            size="lg"
                            onClick={handleAnalyzeMatch}
                            disabled={isAnalyzing || !formData.substackUrl}
                            className="shrink-0"
                          >
                            {isAnalyzing ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <Sparkles className="w-4 h-4 mr-2" />
                                Match Our Content
                              </>
                            )}
                          </Button>
                          {!formData.substackUrl && !isAnalyzing && (
                            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-1.5 bg-foreground text-background text-xs rounded-md opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-10">
                              We'll scan both newsletters to suggest topics that fit our overlap
                              <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-foreground" />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                    {errors.substackUrl && (
                      <p className="text-sm text-destructive">{errors.substackUrl}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Your newsletter URL for SMART-powered collaboration ideas (e.g., yourname.substack.com)
                    </p>
                    
                    {/* Show message when creator hasn't linked newsletter */}
                    {!creator.newsletter_url && !creator.substack_url && (
                      <p className="text-xs text-muted-foreground/70 flex items-center gap-1.5 mt-1">
                        <AlertCircle className="w-3 h-3" />
                        Smart matching unavailable — {creator.name} hasn't linked their newsletter yet
                      </p>
                    )}
                  </div>

                  {/* AI Analysis Error Display */}
                  <AnimatePresence>
                    {analysisError && !isAnalyzing && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="p-4 rounded-xl bg-destructive/10 border border-destructive/30">
                          <div className="flex items-start gap-3">
                            <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-destructive">Couldn't find ideas</p>
                              <p className="text-sm text-muted-foreground mt-1">{analysisError}</p>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="mt-2 h-8 px-3"
                                onClick={() => {
                                  setAnalysisError(null);
                                  handleAnalyzeMatch();
                                }}
                              >
                                <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
                                Try Again
                              </Button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* SMART Match Suggestions */}
                  <AnimatePresence>
                    {isAnalyzing && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="p-6 rounded-xl bg-primary/5 border border-primary/20">
                          <div className="flex items-center gap-3">
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                            >
                              <Sparkles className="w-5 h-5 text-primary" />
                            </motion.div>
                            <div>
                              <p className="font-medium">Analyzing your newsletters...</p>
                              <p className="text-sm text-muted-foreground">Finding collaboration ideas based on your writing styles</p>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}

                    {matchResult && matchResult.suggestions.length > 0 && (
                      <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="space-y-4"
                      >
                        <div className="flex items-center gap-2 text-sm font-medium text-primary">
                          <Lightbulb className="w-4 h-4" />
                          SMART Match Ideas
                        </div>
                        
                        <div className="grid gap-3">
                          {matchResult.suggestions.map((suggestion, index) => (
                            <motion.div
                              key={index}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: index * 0.1 }}
                              className="p-4 rounded-xl bg-accent/30 border border-accent/50 hover:border-primary/30 transition-colors"
                            >
                              <div className="flex items-start justify-between gap-4">
                                <div className="flex-1 min-w-0">
                                  <h4 className="font-semibold mb-1">"{suggestion.topic}"</h4>
                                  <p className="text-sm text-muted-foreground mb-2">
                                    {suggestion.description}
                                  </p>
                                  <div className="flex flex-wrap gap-2">
                                    <span className="inline-flex items-center px-2 py-1 rounded-md bg-primary/10 text-xs font-medium text-primary">
                                      {suggestion.format}
                                    </span>
                                  </div>
                                  <p className="text-xs text-muted-foreground mt-2 italic">
                                    {suggestion.whyItWorks}
                                  </p>
                                </div>
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => handleUseSuggestion(suggestion)}
                                  className="shrink-0"
                                >
                                  Use This
                                </Button>
                              </div>
                            </motion.div>
                          ))}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  <div className="space-y-2">
                    <Label htmlFor="message" className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4" />
                      Message to {creator.name}
                    </Label>
                    <Textarea
                      id="message"
                      value={formData.message}
                      onChange={(e) =>
                        setFormData({ ...formData, message: e.target.value })
                      }
                      placeholder="Tell them about the collaboration you have in mind..."
                      rows={4}
                    />
                    {errors.message && (
                      <p className="text-sm text-destructive">{errors.message}</p>
                    )}
                  </div>

                  {/* Turnstile Widget (invisible) */}
                  <TurnstileWidget
                    onVerify={handleTurnstileVerify}
                    onExpire={handleTurnstileExpireOrError}
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
                    variant="hero"
                    size="lg"
                    className="w-full"
                    disabled={isSubmitting || isVerifying}
                  >
                    {isSubmitting || isVerifying ? (
                      <>
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                          className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full mr-2"
                        />
                        {isVerifying ? "Verifying security..." : "Submitting..."}
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-5 h-5 mr-2" />
                        Propose Collaboration
                      </>
                    )}
                  </Button>
                </form>
              </motion.div>
            ) : (
              <motion.div
                key="calendar"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
              >
                <div className="text-center mb-6">
                  <h2 className="text-xl font-semibold mb-2">
                    {creator.collab_mode 
                      ? COLLAB_MODE_METADATA[creator.collab_mode].calendarHeader
                      : 'Target Publication Date'}
                  </h2>
                  <p className="text-muted-foreground">
                    {creator.collab_mode === 'discovery'
                      ? 'When are you available for a quick intro call?'
                      : 'Select your target publish date'}
                  </p>
                </div>

                {/* Async Mode Explainer - Prominent */}
                {creator.collab_mode === 'async' && (
                  <motion.div
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-6 p-4 bg-accent/30 border border-accent/50 rounded-xl"
                  >
                    <div className="flex items-start gap-3">
                      <span className="text-xl">✍️</span>
                      <div>
                        <h4 className="font-semibold text-sm mb-2">How async collaboration works</h4>
                        <ol className="text-sm text-muted-foreground space-y-1 list-decimal list-inside">
                          <li>You pick a <span className="font-medium text-foreground">target publish date</span> (not a meeting)</li>
                          <li>{creator.name} shares a draft for your review</li>
                          <li>Refine together asynchronously — no calls needed</li>
                        </ol>
                      </div>
                    </div>
                  </motion.div>
                )}

                <CollabCalendar
                  availableDates={availability?.available_dates || []}
                  bookedDates={bookedDates}
                  blockedDates={availability?.blocked_dates || []}
                  onDateSelect={handleDateSelect}
                  availableLegendText={
                    creator.collab_mode === 'discovery' 
                      ? 'Available for call' 
                      : creator.collab_mode === 'async'
                        ? 'Open for publishing'
                        : getCalendarLegendText(creator.date_meaning)
                  }
                  collabMode={creator.collab_mode as 'async' | 'discovery' | null}
                />

                {(!availability?.available_dates || availability.available_dates.length === 0) && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="text-center mt-6 p-8 bg-accent/20 border border-accent/30 rounded-xl"
                  >
                    <Calendar className="w-12 h-12 text-primary/50 mx-auto mb-4" />
                    <h3 className="font-semibold text-lg mb-2">Flexible Scheduling</h3>
                    <p className="text-muted-foreground mb-6 max-w-sm mx-auto">
                      {creator.name} hasn't set specific dates yet, but you can still propose a collaboration!
                    </p>
                    <Button 
                      variant="gradient" 
                      size="lg"
                      onClick={() => setIsFlexibleDate(true)}
                    >
                      <Sparkles className="w-4 h-4 mr-2" />
                      Propose with Flexible Date
                    </Button>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-center mt-8"
        >
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <Sparkles className="w-4 h-4" />
            Powered by DraftKit
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
