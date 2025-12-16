import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Link, useNavigate } from "react-router-dom";
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
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { CollabCalendar } from "@/components/calendar/CollabCalendar";
import {
  isUsernameTaken,
  saveCreator,
  setCurrentUser,
  saveAvailability,
  generateId,
  Creator,
} from "@/lib/storage";
import { toast } from "sonner";

type Step = 1 | 2 | 3 | 4;

export default function Signup() {
  const navigate = useNavigate();
  const [currentStep, setCurrentStep] = useState<Step>(1);
  const [isLoading, setIsLoading] = useState(false);
  const [createdUser, setCreatedUser] = useState<Creator | null>(null);
  const [availableDates, setAvailableDates] = useState<string[]>([]);

  const [formData, setFormData] = useState({
    email: "",
    password: "",
    name: "",
    username: "",
    substackUrl: "",
    welcomeMessage: "",
  });

  const steps = [
    { number: 1, title: "Account" },
    { number: 2, title: "Profile" },
    { number: 3, title: "Availability" },
    { number: 4, title: "Done!" },
  ];

  const handleStep1 = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 300));
    setIsLoading(false);
    setCurrentStep(2);
  };

  const handleStep2 = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Check username
    if (isUsernameTaken(formData.username)) {
      toast.error("Username is already taken. Please choose another.");
      setIsLoading(false);
      return;
    }

    // Create user
    const newUser: Creator = {
      id: generateId(),
      username: formData.username,
      name: formData.name,
      email: formData.email,
      substackUrl: formData.substackUrl,
      bio: "",
      welcomeMessage: formData.welcomeMessage || `Hi! I'm ${formData.name}. Let's collaborate!`,
      createdAt: new Date().toISOString(),
    };

    saveCreator(newUser);
    setCreatedUser(newUser);
    setCurrentUser(newUser);
    setIsLoading(false);
    setCurrentStep(3);
  };

  const handleToggleAvailable = (date: string) => {
    if (availableDates.includes(date)) {
      setAvailableDates(availableDates.filter((d) => d !== date));
    } else {
      setAvailableDates([...availableDates, date]);
    }
  };

  const handleStep3 = () => {
    if (createdUser) {
      saveAvailability({
        username: createdUser.username,
        availableDates,
        blockedDates: [],
        recurringDays: [],
      });
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
                    Start organizing your collaborations
                  </p>
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
                </form>

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
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="username">Username</Label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground">
                        collabflow.com/
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
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="substackUrl" className="flex items-center gap-2">
                      <ExternalLink className="w-4 h-4" />
                      Substack URL
                    </Label>
                    <Input
                      id="substackUrl"
                      type="url"
                      required
                      value={formData.substackUrl}
                      onChange={(e) =>
                        setFormData({ ...formData, substackUrl: e.target.value })
                      }
                      placeholder="https://yourname.substack.com"
                      className="h-12"
                    />
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
                  >
                    Skip for now
                  </Button>
                  <Button
                    variant="hero"
                    size="lg"
                    className="flex-1"
                    onClick={handleStep3}
                  >
                    Continue
                    <ArrowRight className="w-4 h-4 ml-2" />
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
                  <div className="flex items-center gap-2">
                    <code className="flex-1 p-3 bg-background rounded-lg font-mono text-sm truncate">
                      {window.location.origin}/{createdUser.username}
                    </code>
                    <Button variant="outline" size="icon" onClick={handleCopyLink}>
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex flex-col gap-3">
                  <Button variant="hero" size="lg" asChild>
                    <Link to="/dashboard">Go to Dashboard</Link>
                  </Button>
                  <Button variant="ghost" asChild>
                    <Link to={`/${createdUser.username}`} target="_blank">
                      Preview Your Page
                      <ExternalLink className="w-4 h-4 ml-2" />
                    </Link>
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
