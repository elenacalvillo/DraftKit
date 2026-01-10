import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Calendar, Check, ExternalLink, Sparkles, Mail, User, MessageSquare, Lightbulb, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CollabCalendar } from "@/components/calendar/CollabCalendar";
import { supabase } from "@/integrations/supabase/client";
import { bookingFormSchema } from "@/lib/validations";
import { toast } from "sonner";
import { analyzeCollabMatch, type CollabSuggestion, type CollabMatchResult } from "@/lib/api/collab-match";

interface Creator {
  id: string;
  username: string;
  name: string;
  substack_url: string | null;
  newsletter_url: string | null;
  welcome_message: string | null;
  profile_image_url: string | null;
}

interface Availability {
  available_dates: string[];
  blocked_dates: string[];
}

export default function PublicBooking() {
  const { username } = useParams<{ username: string }>();
  const [creator, setCreator] = useState<Creator | null>(null);
  const [availability, setAvailability] = useState<Availability | null>(null);
  const [bookedDates, setBookedDates] = useState<string[]>([]);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [isFlexibleDate, setIsFlexibleDate] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // AI Match state
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [matchResult, setMatchResult] = useState<CollabMatchResult | null>(null);
  const [hasAnalyzed, setHasAnalyzed] = useState(false);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    substackUrl: "",
    message: "",
  });

  useEffect(() => {
    if (!username) return;
    fetchCreatorData();
  }, [username]);

  const fetchCreatorData = async () => {
    if (!username) return;

    setIsLoading(true);

    // Fetch creator from public view (excludes sensitive data like email)
    const { data: creatorData, error } = await supabase
      .from('public_creator_profiles')
      .select('id, username, name, substack_url, newsletter_url, welcome_message, profile_image_url')
      .eq('username', username)
      .maybeSingle();

    if (error || !creatorData) {
      setNotFound(true);
      setIsLoading(false);
      return;
    }

    setCreator(creatorData);

    // Fetch availability
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

    // Fetch booked dates (approved or pending requests)
    const { data: reqData } = await supabase
      .from('collab_requests')
      .select('requested_date')
      .eq('creator_id', creatorData.id)
      .neq('status', 'declined');

    if (reqData) {
      setBookedDates(reqData.map((r) => r.requested_date));
    }

    setIsLoading(false);
  };

  const handleDateSelect = (date: string) => {
    setSelectedDate(date);
  };

  const handleAnalyzeMatch = async () => {
    // Use newsletter_url for AI analysis (falls back to substack_url if not set)
    const creatorNewsletterUrl = creator?.newsletter_url || creator?.substack_url;
    if (!formData.substackUrl || !creatorNewsletterUrl) {
      toast.error("Both you and the creator need newsletter URLs to analyze a match");
      return;
    }

    // Basic URL validation
    try {
      new URL(formData.substackUrl);
    } catch {
      toast.error("Please enter a valid Substack URL");
      return;
    }

    setIsAnalyzing(true);
    setMatchResult(null);

    try {
      const creatorNewsletterUrl = creator.newsletter_url || creator.substack_url;
      const result = await analyzeCollabMatch(creatorNewsletterUrl!, formData.substackUrl);
      setMatchResult(result);
      setHasAnalyzed(true);
      toast.success("Found collaboration ideas!");
    } catch (error) {
      console.error("Analysis error:", error);
      toast.error(error instanceof Error ? error.message : "Failed to analyze match. Please try again.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleUseSuggestion = (suggestion: CollabSuggestion) => {
    const newMessage = `I'd love to collaborate on: "${suggestion.topic}"\n\n${suggestion.description}\n\nFormat: ${suggestion.format}`;
    setFormData({ ...formData, message: newMessage });
    toast.success("Suggestion added to your message!");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!selectedDate && !isFlexibleDate) || !username || !creator) return;

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

    // Check if date is still available (only if specific date selected)
    if (selectedDate && !isFlexibleDate) {
      const { data: existingRequest } = await supabase
        .from('collab_requests')
        .select('id')
        .eq('creator_id', creator.id)
        .eq('requested_date', selectedDate)
        .neq('status', 'declined')
        .maybeSingle();

      if (existingRequest) {
        toast.error("This date has just been booked. Please select another date.");
        setSelectedDate(null);
        return;
      }
    }

    setIsSubmitting(true);

    // Fetch requester's Substack profile image
    let requesterProfileImageUrl: string | null = null;
    try {
      const { data: profileData, error: profileError } = await supabase.functions.invoke(
        "fetch-substack-profile",
        { body: { substackUrl: formData.substackUrl.trim() } }
      );
      
      if (!profileError && profileData?.imageUrl) {
        requesterProfileImageUrl = profileData.imageUrl;
      }
    } catch (e) {
      // Continue without profile image - it's not critical
      console.log("Could not fetch requester profile image:", e);
    }

    const { error } = await supabase
      .from('collab_requests')
      .insert({
        creator_id: creator.id,
        requester_name: formData.name.trim(),
        requester_email: formData.email.trim(),
        requester_substack_url: formData.substackUrl.trim(),
        requester_profile_image_url: requesterProfileImageUrl,
        message: formData.message.trim() || null,
        requested_date: isFlexibleDate ? null : selectedDate,
        status: 'pending',
      });

    if (error) {
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

    setIsSubmitting(false);
    setIsSuccess(true);
    toast.success("Request sent successfully!");
  };

  const formatSelectedDate = (dateStr: string) => {
    const date = new Date(dateStr);
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

  return (
    <div className="min-h-screen gradient-bg">
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
          className="absolute top-1/4 -right-1/4 w-1/2 h-1/2 rounded-full bg-gradient-to-br from-primary/20 to-transparent blur-3xl"
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
          className="absolute -bottom-1/4 -left-1/4 w-1/2 h-1/2 rounded-full bg-gradient-to-tr from-accent/20 to-transparent blur-3xl"
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
            <span className="text-sm">Back to CollabFlow</span>
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
              className="w-20 h-20 rounded-full mx-auto mb-6 object-cover shadow-glow ring-4 ring-primary/20"
            />
          ) : (
            <div className="w-20 h-20 rounded-full gradient-primary mx-auto mb-6 flex items-center justify-center shadow-glow">
              <span className="text-3xl font-bold text-primary-foreground">
                {creator.name.charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <h1 className="text-4xl font-bold mb-4">{creator.name}</h1>
          {creator.substack_url && (
            <a
              href={creator.substack_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-primary hover:underline mb-4"
            >
              <ExternalLink className="w-4 h-4" />
              View Substack
            </a>
          )}
          {creator.welcome_message && (
            <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
              {creator.welcome_message}
            </p>
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
                <p className="text-muted-foreground mb-6 max-w-md mx-auto">
                  {creator.name} has received your collaboration request
                  {selectedDate && !isFlexibleDate ? (
                    <>
                      {" "}for{" "}
                      <span className="font-medium text-foreground">
                        {formatSelectedDate(selectedDate)}
                      </span>
                    </>
                  ) : (
                    " with flexible timing"
                  )}
                  . They'll be in touch soon.
                </p>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setIsSuccess(false);
                    setSelectedDate(null);
                    setIsFlexibleDate(false);
                    setFormData({ name: "", email: "", substackUrl: "", message: "" });
                    setMatchResult(null);
                    setHasAnalyzed(false);
                  }}
                >
                  Request Another Date
                </Button>
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

                <div className="mb-8">
                  <div className="inline-flex items-center gap-3 px-4 py-3 bg-primary/10 rounded-xl">
                    <Calendar className="w-5 h-5 text-primary" />
                    <span className="font-medium">
                      {isFlexibleDate ? "Flexible - Let's discuss timing" : formatSelectedDate(selectedDate!)}
                    </span>
                  </div>
                </div>

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
                    <div className="flex gap-2">
                      <Input
                        id="substackUrl"
                        type="text"
                        required
                        value={formData.substackUrl}
                        onChange={(e) => {
                          setFormData({ ...formData, substackUrl: e.target.value });
                          // Reset analysis when URL changes
                          if (hasAnalyzed) {
                            setMatchResult(null);
                            setHasAnalyzed(false);
                          }
                        }}
                        placeholder="yourname.substack.com"
                        className="h-12 flex-1"
                      />
                      {(creator.newsletter_url || creator.substack_url) && (
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
                              Find Ideas
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                    {errors.substackUrl && (
                      <p className="text-sm text-destructive">{errors.substackUrl}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Your newsletter URL for AI-powered collaboration ideas (e.g., yourname.substack.com)
                    </p>
                  </div>

                  {/* AI Match Suggestions */}
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
                          AI Collaboration Ideas
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

                  <Button
                    type="submit"
                    variant="hero"
                    size="lg"
                    className="w-full"
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full"
                      />
                    ) : (
                      <>
                        <Sparkles className="w-5 h-5 mr-2" />
                        Request Collaboration
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
                <div className="text-center mb-8">
                  <h2 className="text-xl font-semibold mb-2">Select a Date</h2>
                  <p className="text-muted-foreground">
                    Choose an available date to collaborate with {creator.name}
                  </p>
                </div>

                <CollabCalendar
                  availableDates={availability?.available_dates || []}
                  bookedDates={bookedDates}
                  blockedDates={availability?.blocked_dates || []}
                  onDateSelect={handleDateSelect}
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
                      {creator.name} hasn't set specific dates yet, but you can still send a collaboration request!
                    </p>
                    <Button 
                      variant="gradient" 
                      size="lg"
                      onClick={() => setIsFlexibleDate(true)}
                    >
                      <Sparkles className="w-4 h-4 mr-2" />
                      Request with Flexible Date
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
            Powered by CollabFlow
          </Link>
        </motion.div>
      </div>
    </div>
  );
}
