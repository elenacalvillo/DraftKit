import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  ArrowRight,
  Mail,
  Lock,
  User,
  ExternalLink,
  Sparkles,
  Check,
  Calendar,
  MessageSquare,
  Copy,
  Users,
  Shield,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { CollabCalendar } from "@/components/calendar/CollabCalendar";
import { Checkbox } from "@/components/ui/checkbox";
import { useAuth } from "@/hooks/useAuth";
import { useAnalytics } from "@/hooks/useAnalytics";
import { supabase } from "@/integrations/supabase/client";
import { signupStep1Schema, signupStep2Schema } from "@/lib/validations";
import { toast } from "sonner";
import { GoogleIcon } from "@/components/icons/GoogleIcon";

type Step = 1 | 2 | 3 | 4;

interface CreatorData {
  id: string;
  username: string;
  name: string;
}

export default function Signup() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user, creator, loading, signUp, signInWithGoogle, refreshCreator } = useAuth();
  const { trackEvent } = useAnalytics();
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [createdUser, setCreatedUser] = useState<CreatorData | null>(null);
  const [availableDates, setAvailableDates] = useState<string[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Check if coming from a collab request submission
  const prefillEmail = searchParams.get('email') || '';
  const prefillName = searchParams.get('name') || '';
  const prefillSubstack = searchParams.get('substack') || '';
  const isFromCollabRequest = Boolean(prefillEmail || prefillName);

  const [formData, setFormData] = useState({
    email: prefillEmail,
    password: "",
    name: prefillName,
    username: "",
    substackUrl: "",  // Profile URL - user enters manually for profile image
    newsletterUrl: prefillSubstack,  // Pre-fill with publication URL from collab request
    welcomeMessage: "",
    joinDirectory: false,
  });

  useEffect(() => {
    if (!loading && user) {
      // If user exists but no creator profile, go to step 2
      if (!creator) {
        setCurrentStep(2);
        setFormData(prev => ({ ...prev, email: user.email || '' }));
      } else {
        navigate("/dashboard");
      }
    }
  }, [user, creator, loading, navigate]);

  const steps = [
    { number: 1, title: "Account" },
    { number: 2, title: "Profile" },
    { number: 3, title: "Availability" },
    { number: 4, title: "Done!" },
  ];

  const handleStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    
    // Validate inputs
    const result = signupStep1Schema.safeParse({
      email: formData.email,
      password: formData.password,
    });
    
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        const field = err.path[0] as string;
        fieldErrors[field] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setIsLoading(true);

    const { error, data } = await signUp(formData.email, formData.password);

    if (error) {
      if (error.message.includes('already registered')) {
        toast.error("An account with this email already exists. Please sign in.");
      } else {
        toast.error(error.message);
      }
      setIsLoading(false);
      return;
    }

    setIsLoading(false);
    setCurrentStep(2);
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    const { error } = await signInWithGoogle();
    
    if (error) {
      toast.error(error.message || "Failed to sign in with Google");
      setIsGoogleLoading(false);
    }
    // Don't set loading to false on success - the page will redirect
  };

  const handleStep2 = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    
    // Validate inputs
    const result = signupStep2Schema.safeParse({
      name: formData.name,
      username: formData.username,
      substackUrl: formData.substackUrl || undefined,
      newsletterUrl: formData.newsletterUrl,
      welcomeMessage: formData.welcomeMessage || undefined,
    });
    
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        const field = err.path[0] as string;
        fieldErrors[field] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setIsLoading(true);

    // Get current session
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.user) {
      toast.error("Session expired. Please sign in again.");
      navigate("/login");
      return;
    }

    // Check if username is taken
    const { data: existingUser } = await supabase
      .from('creators')
      .select('username')
      .eq('username', formData.username)
      .maybeSingle();

    if (existingUser) {
      setErrors({ username: "Username is already taken" });
      setIsLoading(false);
      return;
    }

    // Fetch profile image from Substack if URL provided
    let profileImageUrl = null;
    if (formData.substackUrl) {
      try {
        const { data: profileData } = await supabase.functions.invoke(
          "fetch-substack-profile",
          { body: { substackUrl: formData.substackUrl } }
        );
        if (profileData?.imageUrl) {
          profileImageUrl = profileData.imageUrl;
        }
      } catch (e) {
        console.log("Could not fetch profile image during signup:", e);
      }
    }

    // Create creator profile
    const { data: newCreator, error } = await supabase
      .from('creators')
      .insert({
        user_id: session.user.id,
        username: formData.username,
        name: formData.name,
        email: formData.email,
        substack_url: formData.substackUrl || null,
        newsletter_url: formData.newsletterUrl,
        welcome_message: formData.welcomeMessage || `Hi! I'm ${formData.name}. Let's collaborate!`,
        join_directory_waitlist: formData.joinDirectory,
        profile_image_url: profileImageUrl,
      })
      .select()
      .single();

    if (error) {
      toast.error("Failed to create profile. Please try again.");
      setIsLoading(false);
      return;
    }

    setCreatedUser({
      id: newCreator.id,
      username: newCreator.username,
      name: newCreator.name,
    });
    
    await refreshCreator();
    setIsLoading(false);
    setCurrentStep(3);
    
    // Track signup
    trackEvent("user_signup", { username: newCreator.username });
  };

  const handleToggleAvailable = (date: string) => {
    if (availableDates.includes(date)) {
      setAvailableDates(availableDates.filter((d) => d !== date));
    } else {
      setAvailableDates([...availableDates, date]);
    }
  };

  const handleStep3 = async () => {
    if (createdUser) {
      setIsLoading(true);
      
      // Save availability
      const { error } = await supabase
        .from('availability')
        .insert({
          creator_id: createdUser.id,
          available_dates: availableDates,
          blocked_dates: [],
          recurring_days: [],
        });

      if (error) {
        toast.error("Failed to save availability");
      }
      
      setIsLoading(false);
    }
    setCurrentStep(4);
  };

  const handleCopyLink = () => {
    if (createdUser) {
      navigator.clipboard.writeText(
        `${window.location.origin}/${createdUser.username}`
      );
      toast.success("Link copied to clipboard!");
    }
  };

  if (loading) {
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

  return (
    <div className="min-h-screen gradient-bg flex items-center justify-center p-6">
      {/* Background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute -top-1/4 -left-1/4 w-1/2 h-1/2 rounded-full bg-gradient-to-br from-accent/20 to-transparent blur-3xl"
        />
        <motion.div
          animate={{
            scale: [1.2, 1, 1.2],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{
            duration: 10,
            repeat: Infinity,
            ease: "easeInOut",
          }}
          className="absolute -bottom-1/4 -right-1/4 w-1/2 h-1/2 rounded-full bg-gradient-to-tl from-primary/20 to-transparent blur-3xl"
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg relative z-10"
      >
        {/* Back button */}
        {currentStep === 1 && (
          <Link
            to="/"
            className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 transition-colors"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to home
          </Link>
        )}

        {/* Progress steps */}
        <div className="flex items-center justify-center gap-2 mb-8">
          {steps.map((step, index) => (
            <div key={step.number} className="flex items-center">
              <motion.div
                initial={false}
                animate={{
                  backgroundColor:
                    currentStep >= step.number
                      ? "hsl(var(--primary))"
                      : "hsl(var(--muted))",
                }}
                className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium"
              >
                {currentStep > step.number ? (
                  <Check className="w-4 h-4 text-primary-foreground" />
                ) : (
                  <span
                    className={
                      currentStep >= step.number
                        ? "text-primary-foreground"
                        : "text-muted-foreground"
                    }
                  >
                    {step.number}
                  </span>
                )}
              </motion.div>
              {index < steps.length - 1 && (
                <div
                  className={`w-8 h-0.5 mx-1 ${
                    currentStep > step.number ? "bg-primary" : "bg-muted"
                  }`}
                />
              )}
            </div>
          ))}
        </div>

        {/* Card */}
        <div className="glass-card p-8 overflow-hidden">
          <AnimatePresence mode="wait">
            {/* Step 1: Account */}
            {currentStep === 1 && (
              <motion.div
                key="step1"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <div className="text-center mb-8">
                  <div className="w-14 h-14 rounded-xl gradient-primary mx-auto mb-4 flex items-center justify-center shadow-glow">
                    <Sparkles className="w-7 h-7 text-primary-foreground" />
                  </div>
                  <h1 className="text-2xl font-bold">Create Account</h1>
                  <p className="text-muted-foreground mt-1">
                    {isFromCollabRequest 
                      ? "Complete your signup to track your collaboration request"
                      : "Start organizing your collaborations"
                    }
                  </p>
                  {isFromCollabRequest && (
                    <div className="mt-3 inline-flex items-center gap-2 text-sm text-primary bg-primary/10 px-3 py-1.5 rounded-full">
                      <Check className="w-3.5 h-3.5" />
                      Your request was submitted successfully
                    </div>
                  )}
                </div>

                <form onSubmit={handleStep1} className="space-y-6">
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
                      placeholder="you@example.com"
                      className="h-12"
                    />
                    {errors.email && (
                      <p className="text-sm text-destructive">{errors.email}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="password" className="flex items-center gap-2">
                      <Lock className="w-4 h-4" />
                      Password
                    </Label>
                    <Input
                      id="password"
                      type="password"
                      required
                      minLength={6}
                      value={formData.password}
                      onChange={(e) =>
                        setFormData({ ...formData, password: e.target.value })
                      }
                      placeholder="••••••••"
                      className="h-12"
                    />
                    {errors.password && (
                      <p className="text-sm text-destructive">{errors.password}</p>
                    )}
                  </div>

                  <Button
                    type="submit"
                    variant="hero"
                    size="lg"
                    className="w-full"
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full"
                      />
                    ) : (
                      <>
                        Continue
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>

                  <p className="text-center text-xs text-muted-foreground mt-4 flex items-center justify-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-primary/60" />
                    We respect your privacy. No data selling. We never train on your private drafts.
                  </p>
                </form>

                {/* Divider */}
                <div className="relative my-6">
                  <div className="absolute inset-0 flex items-center">
                    <Separator className="w-full" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-card px-2 text-muted-foreground">or</span>
                  </div>
                </div>

                {/* Google Sign In */}
                <Button
                  type="button"
                  variant="outline"
                  size="lg"
                  className="w-full h-12 gap-3"
                  onClick={handleGoogleSignIn}
                  disabled={isGoogleLoading}
                >
                  {isGoogleLoading ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="w-5 h-5 border-2 border-foreground border-t-transparent rounded-full"
                    />
                  ) : (
                    <>
                      <GoogleIcon className="w-5 h-5" />
                      Continue with Google
                    </>
                  )}
                </Button>

                <p className="text-center text-sm text-muted-foreground mt-6">
                  Already have an account?{" "}
                  <Link to="/login" className="text-primary hover:underline font-medium">
                    Sign in
                  </Link>
                </p>
              </motion.div>
            )}

            {/* Step 2: Profile */}
            {currentStep === 2 && (
              <motion.div
                key="step2"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <div className="text-center mb-8">
                  <div className="w-14 h-14 rounded-xl bg-secondary mx-auto mb-4 flex items-center justify-center">
                    <User className="w-7 h-7 text-secondary-foreground" />
                  </div>
                  <h1 className="text-2xl font-bold">Your Profile</h1>
                  <p className="text-muted-foreground mt-1">
                    Tell us about yourself
                  </p>
                </div>

                <form onSubmit={handleStep2} className="space-y-6">
                  <div className="space-y-2">
                    <Label htmlFor="name">Display Name</Label>
                    <Input
                      id="name"
                      required
                      value={formData.name}
                      onChange={(e) =>
                        setFormData({ ...formData, name: e.target.value })
                      }
                      placeholder="Your name"
                      className="h-12"
                    />
                    {errors.name && (
                      <p className="text-sm text-destructive">{errors.name}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                        draftkit.app/
                      </span>
                      <Input
                        id="username"
                        required
                        value={formData.username}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            username: e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ""),
                          })
                        }
                        placeholder="yourname"
                        className="h-12 pl-[135px]"
                      />
                    </div>
                    {errors.username && (
                      <p className="text-sm text-destructive">{errors.username}</p>
                    )}
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="newsletterUrl" className="flex items-center gap-2">
                      <ExternalLink className="w-4 h-4" />
                      Your Newsletter URL <span className="text-destructive">*</span>
                    </Label>
                    <Input
                      id="newsletterUrl"
                      type="text"
                      required
                      value={formData.newsletterUrl}
                      onChange={(e) =>
                        setFormData({ ...formData, newsletterUrl: e.target.value })
                      }
                      placeholder="yourname.substack.com"
                      className="h-12"
                    />
                    {errors.newsletterUrl && (
                      <p className="text-sm text-destructive">{errors.newsletterUrl}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Required for SMART-powered content matching. Use format: yourname.substack.com
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="substackUrl" className="flex items-center gap-2">
                      <User className="w-4 h-4" />
                      Substack Profile (Optional)
                    </Label>
                    <Input
                      id="substackUrl"
                      type="url"
                      value={formData.substackUrl}
                      onChange={(e) =>
                        setFormData({ ...formData, substackUrl: e.target.value })
                      }
                      placeholder="substack.com/@yourname"
                      className="h-12"
                    />
                    {errors.substackUrl && (
                      <p className="text-sm text-destructive">{errors.substackUrl}</p>
                    )}
                    <p className="text-xs text-muted-foreground">
                      Your author profile page (for display on your public page)
                    </p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="welcomeMessage" className="flex items-center gap-2">
                      <MessageSquare className="w-4 h-4" />
                      Welcome Message (Optional)
                    </Label>
                    <Textarea
                      id="welcomeMessage"
                      value={formData.welcomeMessage}
                      onChange={(e) =>
                        setFormData({ ...formData, welcomeMessage: e.target.value })
                      }
                      placeholder="This will be shown on your public page..."
                      rows={3}
                    />
                    {errors.welcomeMessage && (
                      <p className="text-sm text-destructive">{errors.welcomeMessage}</p>
                    )}
                  </div>

                  {/* Join Directory Waitlist */}
                  <div className="flex items-start gap-3 p-4 rounded-lg bg-primary/5 border border-primary/10">
                    <Checkbox
                      id="joinDirectory"
                      checked={formData.joinDirectory}
                      onCheckedChange={(checked) =>
                        setFormData({ ...formData, joinDirectory: checked as boolean })
                      }
                      className="mt-0.5"
                    />
                    <div className="grid gap-1.5 leading-none">
                      <Label htmlFor="joinDirectory" className="cursor-pointer flex items-center gap-2">
                        <Users className="w-4 h-4 text-primary" />
                        Join the Creator Directory (Coming Soon)
                      </Label>
                      <p className="text-sm text-muted-foreground">
                        Be discoverable by other Substack creators looking for collaboration partners
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button
                      type="button"
                      variant="outline"
                      size="lg"
                      onClick={() => setCurrentStep(1)}
                    >
                      <ArrowLeft className="w-4 h-4" />
                    </Button>
                    <Button
                      type="submit"
                      variant="hero"
                      size="lg"
                      className="flex-1"
                      disabled={isLoading}
                    >
                      {isLoading ? (
                        <motion.div
                          animate={{ rotate: 360 }}
                          transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                          className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full"
                        />
                      ) : (
                        <>
                          Continue
                          <ArrowRight className="w-4 h-4 ml-2" />
                        </>
                      )}
                    </Button>
                  </div>
                </form>
              </motion.div>
            )}

            {/* Step 3: Availability */}
            {currentStep === 3 && (
              <motion.div
                key="step3"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <div className="text-center mb-6">
                  <div className="w-14 h-14 rounded-xl bg-available/20 mx-auto mb-4 flex items-center justify-center">
                    <Calendar className="w-7 h-7 text-available" />
                  </div>
                  <h1 className="text-2xl font-bold">Set Availability</h1>
                  <p className="text-muted-foreground mt-1">
                    Click dates when you're available
                  </p>
                </div>

                <div className="mb-6">
                  <CollabCalendar
                    availableDates={availableDates}
                    isEditable={true}
                    onToggleAvailable={handleToggleAvailable}
                  />
                </div>

                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="ghost"
                    size="lg"
                    onClick={handleStep3}
                    disabled={isLoading}
                  >
                    Skip for now
                  </Button>
                  <Button
                    variant="hero"
                    size="lg"
                    className="flex-1"
                    onClick={handleStep3}
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                        className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full"
                      />
                    ) : (
                      <>
                        Continue
                        <ArrowRight className="w-4 h-4 ml-2" />
                      </>
                    )}
                  </Button>
                </div>
              </motion.div>
            )}

            {/* Step 4: Done */}
            {currentStep === 4 && createdUser && (
              <motion.div
                key="step4"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="text-center"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: "spring", duration: 0.6 }}
                  className="w-20 h-20 rounded-full bg-success/20 mx-auto mb-6 flex items-center justify-center"
                >
                  <Check className="w-10 h-10 text-success" />
                </motion.div>

                <h1 className="text-2xl font-bold mb-2">You're All Set!</h1>
                <p className="text-muted-foreground mb-8">
                  Share your link and start receiving collaboration requests
                </p>

                <div className="bg-muted/50 rounded-xl p-4 mb-6">
                  <p className="text-sm text-muted-foreground mb-2">Your public link</p>
                  <p className="font-mono text-lg font-medium break-all">
                    {window.location.origin}/{createdUser.username}
                  </p>
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    size="lg"
                    className="flex-1"
                    onClick={handleCopyLink}
                  >
                    <Copy className="w-4 h-4 mr-2" />
                    Copy Link
                  </Button>
                  <Button
                    variant="hero"
                    size="lg"
                    className="flex-1"
                    onClick={() => navigate("/dashboard")}
                  >
                    Go to Dashboard
                    <ArrowRight className="w-4 h-4 ml-2" />
                  </Button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
