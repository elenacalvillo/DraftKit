import { useState, useEffect, useRef, useCallback } from "react";
import { motion } from "framer-motion";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { ArrowLeft, Mail, Lock, AlertCircle, Eye, EyeOff } from "lucide-react";
import { DraftKitLogo } from "@/components/icons/DraftKitLogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { useAuth } from "@/hooks/useAuth";
import { loginSchema } from "@/lib/validations";
import { toast } from "sonner";
import { GoogleIcon } from "@/components/icons/GoogleIcon";
import { TurnstileWidget } from "@/components/turnstile/TurnstileWidget";
import { verifyTurnstileToken } from "@/lib/turnstile";

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { signIn, signInWithGoogle, user, creator, creatorLoading, loading } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [isGoogleLoading, setIsGoogleLoading] = useState(false);
  const [formData, setFormData] = useState({
    email: "",
    password: "",
  });
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [authError, setAuthError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const [turnstileToken, setTurnstileToken] = useState<string | null>(null);
  const [isVerifying, setIsVerifying] = useState(false);
  const [securityError, setSecurityError] = useState<string | null>(null);
  const turnstileTokenRef = useRef<string | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [securityBypassed, setSecurityBypassed] = useState(false);

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
     setSecurityBypassed(true);
   }, []);

   // Callback when bypass is triggered
   const handleTurnstileBypass = useCallback((reason: string) => {
     console.warn('Security bypassed due to load failure:', reason);
     setSecurityBypassed(true);
   }, []);

  useEffect(() => {
    if (loading) return;
    if (!user) return;
    const from = (location.state as any)?.from?.pathname || null;
    // If the user came from a non-creator-only deep link (e.g. a workspace
    // or sent-requests page), send them there immediately — invited
    // collaborators may not have a creator profile and shouldn't be
    // stuck on the login screen waiting for one.
    const isWorkspaceOrGuestPath =
      !!from &&
      (from === "/dashboard" ||
        from.startsWith("/dashboard/requests") ||
        from.startsWith("/dashboard/my-requests") ||
        from.startsWith("/dashboard/collaborations") ||
        from.startsWith("/dashboard/workspace/") ||
        from.startsWith("/retro/") ||
        from.startsWith("/view/"));
    if (isWorkspaceOrGuestPath) {
      navigate(from!, { replace: true });
      return;
    }
    if (creator) {
      navigate(from || "/dashboard", { replace: true });
      return;
    }
    // OAuth gap fix: an authenticated user with NO creators row is a
    // ghost-user-in-the-making. We've already excluded workspace/guest
    // deep links above (invited collaborators legitimately have no
    // creator profile), so the only remaining cohort is a Google
    // signup that never completed Step 2. Send them straight to
    // /signup so they can finish — the Signup component auto-resumes
    // at Step 2 when it detects a session with no creator row.
    //
    // We wait for creatorLoading to settle so we don't redirect
    // mid-fetch and double-route the user.
    if (!creatorLoading && !creator) {
      navigate("/signup", { replace: true });
    }
  }, [user, creator, creatorLoading, loading, navigate, location.state]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrors({});
    setAuthError(null);
    setSecurityError(null);
    
    const result = loginSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: { email?: string; password?: string } = {};
      result.error.errors.forEach((err) => {
        const field = err.path[0] as string;
        fieldErrors[field as keyof typeof fieldErrors] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setIsLoading(true);

    // If security was bypassed (Turnstile failed to load), skip verification entirely
    if (securityBypassed) {
      console.warn('Login proceeding without security check');
    } else {
      // Wait for turnstile token if not ready yet (invisible mode may still be processing)
      let token = turnstileTokenRef.current;
      if (!token) {
        setIsVerifying(true);
        // Poll for token (10 second timeout)
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
          // Token still not available - bypass and proceed
          console.warn('Login proceeding without security check (token timeout)');
        }
      }

      // Only verify if we have a token
      if (token) {
        const verifyResult = await verifyTurnstileToken(token);
        if (!verifyResult.success) {
          // Log but proceed anyway - bypass mode
          console.warn('Turnstile verification failed, proceeding anyway:', verifyResult.codes);
        }
      }
    }

    const { error } = await signIn(formData.email, formData.password);

    if (error) {
      let errorMessage = "An error occurred. Please try again.";
      if (error.message.includes('Invalid login credentials')) {
        errorMessage = "Invalid email or password. Please try again.";
      } else if (error.message.includes('Email not confirmed')) {
        errorMessage = "Please verify your email before signing in.";
      } else {
        errorMessage = error.message;
      }
      
      setAuthError(errorMessage);
      toast.error(errorMessage);
      setShake(true);
      setTimeout(() => setShake(false), 500);
      handleTurnstileExpireOrError();
      setIsLoading(false);
      return;
    }

    toast.success("Welcome back!");
    const from = (location.state as any)?.from?.pathname || "/dashboard";
    navigate(from, { replace: true });
    setIsLoading(false);
  };

  const handleGoogleSignIn = async () => {
    setIsGoogleLoading(true);
    // Persist the intended return path through the Google redirect round-trip.
    const from = (location.state as any)?.from?.pathname || null;
    if (from) {
      try { sessionStorage.setItem("postAuthRedirect", from); } catch {}
    }
    const { error } = await signInWithGoogle();

    if (error) {
      toast.error(error.message || "Failed to sign in with Google");
      setIsGoogleLoading(false);
    }
    // Don't set loading to false on success - the page will redirect
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
          className="absolute top-0 right-0 w-1/2 h-1/2 rounded-full bg-gradient-to-br from-primary/20 to-transparent blur-3xl"
        />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative z-10"
      >
        {/* Back button */}
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to home
        </Link>

        {/* Card */}
        <div className="glass-card p-8">
          {/* Logo */}
          <div className="text-center mb-8">
            <div className="mx-auto mb-4 flex items-center justify-center">
              <DraftKitLogo size={56} />
            </div>
            <h1 className="text-2xl font-bold">Welcome Back</h1>
            <p className="text-muted-foreground mt-1">
              Sign in to your DraftKit account
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className={`space-y-6 ${shake ? 'animate-shake' : ''}`}>
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
                onChange={(e) => {
                  setFormData({ ...formData, email: e.target.value });
                  setAuthError(null);
                }}
                placeholder="you@example.com"
                className="h-12"
              />
              {errors.email && (
                <p className="text-sm text-destructive">{errors.email}</p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="flex items-center gap-2">
                  <Lock className="w-4 h-4" />
                  Password
                </Label>
                <Link
                  to="/forgot-password"
                  className="text-sm text-primary hover:underline"
                >
                  Forgot password?
                </Link>
              </div>
              <div className="relative">
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                required
                value={formData.password}
                onChange={(e) => {
                  setFormData({ ...formData, password: e.target.value });
                  setAuthError(null);
                }}
                placeholder="••••••••"
                className="h-12 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
              </div>
              {errors.password && (
                <p className="text-sm text-destructive">{errors.password}</p>
              )}
            </div>

            {/* Inline Auth Error */}
            {authError && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                {authError}
              </div>
            )}

            {/* Turnstile Widget (invisible) */}
             {!securityBypassed && (
               <TurnstileWidget
                 onVerify={handleTurnstileVerify}
                 onExpire={handleTurnstileExpireOrError}
                 onError={handleTurnstileError}
                 onBypass={handleTurnstileBypass}
               />
             )}

            <Button
              type="submit"
              variant="hero"
              size="lg"
              className="w-full"
              disabled={isLoading}
            >
              {isLoading ? (
                <>
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                    className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full mr-2"
                  />
                  Signing in...
                </>
              ) : (
                "Sign In"
              )}
            </Button>
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

          {/* Footer */}
          <p className="text-center text-sm text-muted-foreground mt-6">
            Don't have an account?{" "}
            <Link to="/signup" className="text-primary hover:underline font-medium">
              Sign up
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}
