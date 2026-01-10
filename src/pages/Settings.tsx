import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Copy, ExternalLink, Check, AlertTriangle, ArrowLeft } from "lucide-react";
import { Link } from "react-router-dom";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { settingsSchema } from "@/lib/validations";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export default function Settings() {
  const navigate = useNavigate();
  const { user, creator, loading, refreshCreator, signOut } = useAuth();
  const [copied, setCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [formData, setFormData] = useState({
    name: "",
    bio: "",
    substackUrl: "",
    newsletterUrl: "",
    welcomeMessage: "",
  });

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
      });
    }
  }, [user, creator, loading, navigate]);

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

    const { error } = await supabase
      .from('creators')
      .update({
        name: formData.name,
        bio: formData.bio || null,
        substack_url: formData.substackUrl || null,
        newsletter_url: formData.newsletterUrl,
        welcome_message: formData.welcomeMessage || null,
      })
      .eq('id', creator.id);

    if (error) {
      toast.error("Failed to save settings");
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
                Required for AI collaboration suggestions (e.g., yourname.substack.com)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="substackUrl">Substack Profile (Optional)</Label>
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
                Your author profile page (for display)
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

        {/* Integrations */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3 }}
          className="glass-card p-6 mb-6"
        >
          <h2 className="text-lg font-semibold mb-6">Integrations</h2>
          
          <div className="space-y-4">
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

            <div className="flex items-center justify-between p-4 bg-muted/50 rounded-xl">
              <div>
                <h3 className="font-medium">Resend</h3>
                <p className="text-sm text-muted-foreground">
                  Send email notifications
                </p>
              </div>
              <Button variant="outline" disabled>
                Coming Soon
              </Button>
            </div>
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
