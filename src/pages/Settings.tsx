import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Copy, ExternalLink, Check, AlertTriangle, ArrowLeft, User, BookOpen, Crown } from "lucide-react";
import { Link } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/hooks/useAuth";
import { usePro } from "@/hooks/usePro";
import { supabase } from "@/integrations/supabase/client";
import { settingsSchema, COLLAB_TYPE_METADATA, COLLAB_MODE_METADATA, COLLAB_MODE_OPTIONS, type CollabStyle, type DateMeaning, type CollabMode } from "@/lib/validations";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ProfileStyleSection } from "@/components/settings/ProfileStyleSection";

const COLLAB_STYLE_OPTIONS: { value: CollabStyle; label: string; description: string }[] = [
  { value: "Virtual Coffee", label: "Virtual Coffee", description: "30-60 min video call" },
  { value: "Async Drafting", label: "Async Drafting", description: "Collaborative writing" },
  { value: "Interview Style", label: "Interview Style", description: "Q&A format" },
  { value: "Guest Post Exchange", label: "Guest Post Exchange", description: "Publish on each other's newsletters" },
  { value: "Live Event / Webinar", label: "Live Event / Webinar", description: "Co-host a live session" },
  { value: "Co-written Article", label: "Co-written Article", description: "Write together" },
  { value: "Newsletter Shoutout", label: "Newsletter Shoutout", description: "Recommend each other" },
  { value: "Custom", label: "Custom", description: "Define your own format" },
];

const DATE_MEANING_OPTIONS: { value: DateMeaning; label: string; description: string }[] = [
  { value: "kickoff", label: "Kick-off days", description: "The day we start working together" },
  { value: "publish", label: "Publishing days", description: "The day the final piece goes live" },
];

// Async mode recommended collab types (shown first in the list)
const ASYNC_RECOMMENDED_TYPES = ['Async Drafting', 'Guest Post Exchange', 'Interview Style', 'Co-written Article', 'Newsletter Shoutout'];
const DISCOVERY_RECOMMENDED_TYPES = ['Virtual Coffee', 'Live Event / Webinar'];

export default function Settings() {
  const navigate = useNavigate();
  const { user, creator, loading, refreshCreator, signOut } = useAuth();
  const { isPro } = usePro();
  const [copied, setCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isFetchingImage, setIsFetchingImage] = useState(false);
  const [previewImageUrl, setPreviewImageUrl] = useState<string | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    name: "",
    bio: "",
    substackUrl: "",
    newsletterUrl: "",
    welcomeMessage: "",
    collabStyles: ["Virtual Coffee"] as string[],
    collabGuidelines: "",
    reminderDaysBefore: 3,
    dateMeaning: "flexible" as DateMeaning,
    collabMode: "async" as CollabMode,
  });

  // Parse collab_style from DB (could be single value or JSON array)
  const parseCollabStyles = (value: string | null): string[] => {
    if (!value) return ["Virtual Coffee"];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [value];
    } catch {
      return [value];
    }
  };

  const toggleCollabStyle = (style: string) => {
    setFormData(prev => {
      const current = prev.collabStyles;
      if (current.includes(style)) {
        // Prevent removing if it's the last one
        if (current.length === 1) {
          toast.error("You must have at least one collaboration style selected");
          return prev;
        }
        return { ...prev, collabStyles: current.filter(s => s !== style) };
      } else {
        return { ...prev, collabStyles: [...current, style] };
      }
    });
  };

  // Auto-fetch profile image if missing
  const autoFetchProfileImage = async (substackUrl: string) => {
    if (!substackUrl) return;
    
    setIsFetchingImage(true);
    try {
      const { data: profileData, error: profileError } = await supabase.functions.invoke(
        "fetch-substack-profile",
        { body: { substackUrl } }
      );
      
      if (!profileError && profileData?.imageUrl) {
        setPreviewImageUrl(profileData.imageUrl);
        
        // Also save to database immediately
        if (creator) {
          await supabase
            .from('creators')
            .update({ profile_image_url: profileData.imageUrl })
            .eq('id', creator.id);
          await refreshCreator();
        }
      }
    } catch (e) {
      console.log("Auto-fetch profile image failed:", e);
    } finally {
      setIsFetchingImage(false);
    }
  };

  useEffect(() => {
    if (!loading && !user) {
      navigate("/login");
      return;
    }

    if (!loading && user && !creator) {
      navigate("/signup");
      return;
    }

    if (creator) {
      setFormData({
        name: creator.name,
        bio: creator.bio || "",
        substackUrl: creator.substack_url || "",
        newsletterUrl: (creator as any).newsletter_url || "",
        welcomeMessage: creator.welcome_message || "",
        collabStyles: parseCollabStyles((creator as any).collab_style),
        collabGuidelines: (creator as any).collab_guidelines || "",
        reminderDaysBefore: (creator as any).reminder_days_before ?? 3,
        dateMeaning: ((creator as any).date_meaning || "flexible") as DateMeaning,
        collabMode: ((creator as any).collab_mode || "async") as CollabMode,
      });
      setPreviewImageUrl((creator as any).profile_image_url || null);
      
      // Auto-fetch profile image if missing but substack URL exists
      if (!(creator as any).profile_image_url && creator.substack_url) {
        autoFetchProfileImage(creator.substack_url);
      }
    }
    // Only re-initialize when creator ID changes (not on every re-fetch)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [creator?.id, loading, navigate]);

  const handleSave = async () => {
    if (!creator) return;

    setErrors({});

    // Validate inputs
    const result = settingsSchema.safeParse(formData);
    if (!result.success) {
      const fieldErrors: Record<string, string> = {};
      result.error.errors.forEach((err) => {
        const field = err.path[0] as string;
        fieldErrors[field] = err.message;
      });
      setErrors(fieldErrors);
      return;
    }

    setIsSaving(true);

    // Use the preview image URL (already fetched) or fetch if not available
    let profileImageUrl = previewImageUrl;
    if (!profileImageUrl && formData.substackUrl) {
      try {
        const { data: profileData, error: profileError } = await supabase.functions.invoke(
          "fetch-substack-profile",
          { body: { substackUrl: formData.substackUrl } }
        );
        
        if (!profileError && profileData?.imageUrl) {
          profileImageUrl = profileData.imageUrl;
          setPreviewImageUrl(profileImageUrl);
        }
      } catch (e) {
        console.log("Error fetching profile image:", e);
      }
    }

    const { error } = await supabase
      .from('creators')
      .update({
        name: formData.name,
        bio: formData.bio || null,
        substack_url: formData.substackUrl || null,
        newsletter_url: formData.newsletterUrl,
        welcome_message: formData.welcomeMessage || null,
        profile_image_url: profileImageUrl,
        collab_style: JSON.stringify(formData.collabStyles),
        collab_guidelines: formData.collabGuidelines || null,
        reminder_days_before: formData.reminderDaysBefore,
        date_meaning: formData.dateMeaning,
        collab_mode: formData.collabMode,
      })
      .eq('id', creator.id);

    if (error) {
      console.error("Save error:", error);
      const errorMessage = error.message || "Failed to save settings";
      toast.error(errorMessage);
      setIsSaving(false);
      return;
    }

    await refreshCreator();
    toast.success("Settings saved successfully!");
    setIsSaving(false);
  };

  const handleCopyLink = () => {
    if (!creator) return;
    navigator.clipboard.writeText(`${window.location.origin}/${creator.username}`);
    setCopied(true);
    toast.success("Link copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDeleteAccount = async () => {
    if (!creator || !user) return;
    
    const confirmed = window.confirm(
      "Are you sure you want to delete your account? This action cannot be undone."
    );

    if (!confirmed) return;

    // Delete creator profile (cascades to availability and requests)
    const { error } = await supabase
      .from('creators')
      .delete()
      .eq('id', creator.id);

    if (error) {
      toast.error("Failed to delete account");
      return;
    }

    await signOut();
    toast.success("Account deleted successfully");
    navigate("/");
  };

  if (loading || !creator) {
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

  const publicUrl = `${window.location.origin}/${creator.username}`;

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto">
        {/* Back link */}
        <Link
          to="/dashboard"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors mb-6"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </Link>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-10"
        >
          <h1 className="text-3xl font-bold mb-2">
            <span className="gradient-text">Settings</span>
          </h1>
          <p className="text-muted-foreground">
            Customize your profile and collaboration page
          </p>
        </motion.div>

        {/* Public Link */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="glass-card p-6 mb-6"
        >
          <h2 className="text-lg font-semibold mb-4">Your Public Link</h2>
          <div className="flex gap-3">
            <div className="flex-1 p-3 bg-muted rounded-xl font-mono text-sm truncate">
              {publicUrl}
            </div>
            <Button variant="outline" onClick={handleCopyLink}>
              {copied ? (
                <Check className="w-4 h-4 text-success" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </Button>
            <Button variant="gradient" asChild>
              <a href={`/${creator.username}`} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-4 h-4" />
              </a>
            </Button>
          </div>
        </motion.div>

        {/* Profile Settings */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="glass-card p-6 mb-6"
        >
          <h2 className="text-lg font-semibold mb-6">Profile</h2>
          
          {/* Profile Image Preview */}
          <div className="flex items-center gap-4 mb-6 p-4 bg-muted/50 rounded-xl">
            {previewImageUrl ? (
              <img 
                src={previewImageUrl} 
                alt="Profile preview"
                className="w-16 h-16 rounded-full object-cover ring-2 ring-primary/20"
              />
            ) : (
              <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center">
                <User className="w-8 h-8 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1">
              <p className="text-sm font-medium mb-1">Profile Image</p>
              <p className="text-xs text-muted-foreground">
                {isFetchingImage 
                  ? "Fetching from Substack..." 
                  : previewImageUrl 
                    ? "Fetched from your Substack profile" 
                    : "Add your Substack profile URL below to show your image"}
              </p>
            </div>
          </div>

          <div className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="name">Display Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="Your name"
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={creator.username}
                disabled
                className="opacity-60"
              />
              <p className="text-xs text-muted-foreground">
                Username cannot be changed
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="newsletterUrl">Newsletter URL <span className="text-destructive">*</span></Label>
              <Input
                id="newsletterUrl"
                value={formData.newsletterUrl}
                onChange={(e) =>
                  setFormData({ ...formData, newsletterUrl: e.target.value })
                }
                placeholder="yourname.substack.com"
              />
              {errors.newsletterUrl && (
                <p className="text-sm text-destructive">{errors.newsletterUrl}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Required for SMART-powered content matching (e.g., yourname.substack.com)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="substackUrl">Your Substack Profile</Label>
              <Input
                id="substackUrl"
                value={formData.substackUrl}
                onChange={(e) =>
                  setFormData({ ...formData, substackUrl: e.target.value })
                }
                placeholder="substack.com/@yourname"
              />
              {errors.substackUrl && (
                <p className="text-sm text-destructive">{errors.substackUrl}</p>
              )}
              <p className="text-xs text-muted-foreground">
                Your personal profile page (used for your profile image)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="bio">Bio</Label>
              <Textarea
                id="bio"
                value={formData.bio}
                onChange={(e) =>
                  setFormData({ ...formData, bio: e.target.value })
                }
                placeholder="Tell others about yourself..."
                rows={3}
              />
              {errors.bio && (
                <p className="text-sm text-destructive">{errors.bio}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="welcomeMessage">Welcome Message</Label>
              <Textarea
                id="welcomeMessage"
                value={formData.welcomeMessage}
                onChange={(e) =>
                  setFormData({ ...formData, welcomeMessage: e.target.value })
                }
                placeholder="This message appears on your public booking page..."
                rows={4}
              />
              {errors.welcomeMessage && (
                <p className="text-sm text-destructive">{errors.welcomeMessage}</p>
              )}
              <p className="text-xs text-muted-foreground">
                This is shown to visitors on your public collaboration page
              </p>
            </div>

            <Button 
              variant="gradient" 
              onClick={handleSave} 
              className="w-full"
              disabled={isSaving}
            >
              {isSaving ? (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="w-5 h-5 border-2 border-primary-foreground border-t-transparent rounded-full"
                />
              ) : (
                "Save Changes"
              )}
            </Button>
          </div>
        </motion.div>

        {/* Profile Style */}
        <ProfileStyleSection />

        {/* Collaboration Playbook */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card p-6 mb-6"
        >
          <div className="flex items-center gap-2 mb-6">
            <BookOpen className="w-5 h-5 text-primary" />
            <h2 className="text-lg font-semibold">Collaboration Playbook</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-6">
            Help collaborators know what to expect when working with you. This info is shown on your public booking page.
          </p>
          
          <div className="space-y-6">
            <div className="space-y-3">
              <Label>Preferred Collaboration Styles (select all that apply)</Label>
              <div className="grid gap-3">
                {COLLAB_STYLE_OPTIONS.map((option) => (
                  <div
                    key={option.value}
                    className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${
                      formData.collabStyles.includes(option.value)
                        ? "bg-primary/10 border-primary/30"
                        : "bg-muted/50 border-transparent hover:border-muted-foreground/20"
                    }`}
                    onClick={() => toggleCollabStyle(option.value)}
                  >
                    <Checkbox
                      id={`collab-${option.value}`}
                      checked={formData.collabStyles.includes(option.value)}
                      onCheckedChange={() => toggleCollabStyle(option.value)}
                    />
                    <div className="flex-1">
                      <label 
                        htmlFor={`collab-${option.value}`}
                        className="font-medium cursor-pointer"
                      >
                        {option.label}
                      </label>
                      <p className="text-sm text-muted-foreground">{option.description}</p>
                    </div>
                  </div>
                ))}
              </div>
              <p className="text-xs text-muted-foreground">
                Collaborators will choose one of your selected styles when booking
              </p>
            </div>

            {/* Collaboration Mode Selector */}
            <div className="space-y-3">
              <div className="flex items-center gap-2">
                <Label>How do you prefer to collaborate?</Label>
                {!isPro && (
                  <Badge variant="outline" className="text-xs border-primary/50 text-primary">
                    <Crown className="w-3 h-3 mr-1" />
                    Pro
                  </Badge>
                )}
              </div>
              {isPro ? (
                <div className="grid gap-3">
                  {COLLAB_MODE_OPTIONS.map((mode) => {
                    const metadata = COLLAB_MODE_METADATA[mode];
                    const isSelected = formData.collabMode === mode;
                    return (
                      <div
                        key={mode}
                        className={`p-5 rounded-xl border-2 cursor-pointer transition-all ${
                          isSelected
                            ? "bg-primary/10 border-primary shadow-sm"
                            : "bg-muted/50 border-transparent hover:border-muted-foreground/20"
                        }`}
                        onClick={() => setFormData({ ...formData, collabMode: mode })}
                      >
                        <div className="flex items-start gap-3">
                          <span className="text-2xl">{metadata.icon}</span>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <span className="font-semibold">{metadata.label}</span>
                              {mode === 'async' && (
                                <Badge variant="secondary" className="text-xs">Recommended</Badge>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mb-2">{metadata.description}</p>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Badge 
                                    variant="outline" 
                                    className={`text-xs ${isSelected ? 'border-primary/50 text-primary' : ''}`}
                                  >
                                    {metadata.badge}
                                  </Badge>
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-xs max-w-[200px]">{metadata.badgeTooltip}</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-4 bg-muted/50 rounded-xl border border-dashed">
                  <p className="text-sm text-muted-foreground mb-3">
                    Free accounts use <span className="font-medium text-foreground">"100% Async"</span> mode with Target Publication Dates.
                  </p>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => navigate("/dashboard/settings?upgrade=true")}
                    className="border-primary/30 text-primary hover:bg-primary/10"
                  >
                    <Crown className="w-3.5 h-3.5 mr-2" />
                    Upgrade to customize your collaboration style
                  </Button>
                </div>
              )}
            </div>

            {/* Date Meaning Selector - Only show for async mode */}
            {formData.collabMode === 'async' && (
              <div className="space-y-3">
                <Label>What do your available dates represent?</Label>
                <RadioGroup
                  value={formData.dateMeaning}
                  onValueChange={(value) => setFormData({ ...formData, dateMeaning: value as DateMeaning })}
                  className="grid gap-3"
                >
                  {DATE_MEANING_OPTIONS.map((option) => (
                    <div
                      key={option.value}
                      className={`flex items-center gap-3 p-4 rounded-xl border cursor-pointer transition-colors ${
                        formData.dateMeaning === option.value
                          ? "bg-primary/10 border-primary/30"
                          : "bg-muted/50 border-transparent hover:border-muted-foreground/20"
                      }`}
                      onClick={() => setFormData({ ...formData, dateMeaning: option.value })}
                    >
                      <RadioGroupItem value={option.value} id={`date-${option.value}`} />
                      <div className="flex-1">
                        <label htmlFor={`date-${option.value}`} className="font-medium cursor-pointer">
                          {option.label}
                        </label>
                        <p className="text-sm text-muted-foreground">{option.description}</p>
            </div>
                    </div>
                  ))}
                </RadioGroup>
                {/* Preview of guest experience */}
                <div className="p-3 bg-muted/50 rounded-lg border border-border/50 mt-3">
                  <p className="text-xs text-muted-foreground">
                    <span className="font-medium text-foreground">Guest will see:</span>{" "}
                    "{formData.dateMeaning === 'kickoff' 
                      ? 'This is the day we start working together' 
                      : 'This is our target publish date'}"
                  </p>
                </div>
                <p className="text-xs text-muted-foreground mt-2">
                  This context is shown to collaborators on your booking page
                </p>
              </div>
            )}

            {/* Discovery mode info */}
            {formData.collabMode === 'discovery' && (
              <div className="p-4 bg-accent/20 border border-accent/30 rounded-xl">
                <p className="text-sm text-muted-foreground">
                  <span className="font-medium text-foreground">📅 Dates = Call slots</span><br />
                  Your available dates will be shown as times for intro calls. Visitors will receive a calendar invite after booking.
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="collabGuidelines">Collaboration Guidelines</Label>
              <Textarea
                id="collabGuidelines"
                value={formData.collabGuidelines}
                onChange={(e) =>
                  setFormData({ ...formData, collabGuidelines: e.target.value })
                }
                placeholder="Share how you like to work with collaborators...

Example:
• I prefer 30-minute Zoom calls on Tuesdays or Thursdays
• Please come prepared with 2-3 topic ideas
• I'll send a draft within 5 business days after our call
• I'm open to cross-posts and newsletter swaps"
                rows={6}
              />
              <p className="text-xs text-muted-foreground">
                Markdown supported. These guidelines will be sent to collaborators when you approve their request.
              </p>
            </div>
            
            <Button 
              variant="gradient" 
              onClick={handleSave} 
              className="w-full mt-6"
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : "Save Playbook Settings"}
            </Button>
          </div>
        </motion.div>

        {/* Integrations */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="glass-card p-6 mb-6"
        >
          <h2 className="text-lg font-semibold mb-6">Integrations</h2>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl">
              <div>
                <h3 className="font-medium">Email Notifications</h3>
                <p className="text-sm text-muted-foreground">
                  Collaborators receive emails when you approve or decline requests
                </p>
              </div>
              <span className="text-xs font-medium text-success bg-success/10 px-2 py-1 rounded-full">Active</span>
            </div>

            <div className="p-4 bg-muted/50 rounded-xl">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium">Collaboration Reminders</h3>
                  <p className="text-sm text-muted-foreground">
                    Get notified before your scheduled collaborations
                  </p>
                </div>
                <Select
                  value={String(formData.reminderDaysBefore)}
                  onValueChange={(value) => setFormData({ ...formData, reminderDaysBefore: parseInt(value) })}
                >
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 day before</SelectItem>
                    <SelectItem value="2">2 days before</SelectItem>
                    <SelectItem value="3">3 days before</SelectItem>
                    <SelectItem value="5">5 days before</SelectItem>
                    <SelectItem value="7">7 days before</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <p className="text-xs text-muted-foreground mt-2">
                Both you and your collaborator will receive a reminder email
              </p>
            </div>

            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl">
              <div>
                <h3 className="font-medium">Stripe</h3>
                <p className="text-sm text-muted-foreground">
                  Accept payments for collaborations
                </p>
              </div>
              <Button variant="outline" disabled>
                Coming Soon
              </Button>
            </div>
            
            <Button 
              variant="gradient" 
              onClick={handleSave} 
              className="w-full mt-6"
              disabled={isSaving}
            >
              {isSaving ? "Saving..." : "Save Integration Settings"}
            </Button>
          </div>
        </motion.div>

        {/* Danger Zone */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="glass-card p-6 border-destructive/20"
        >
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-destructive" />
            <h2 className="text-lg font-semibold text-destructive">Danger Zone</h2>
          </div>
          <p className="text-sm text-muted-foreground mb-4">
            Once you delete your account, there is no going back. Please be certain.
          </p>
          <Button variant="destructive" className="w-full" onClick={handleDeleteAccount}>
            Delete Account
          </Button>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}
