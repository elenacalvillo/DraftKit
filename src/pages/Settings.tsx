import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Copy, ExternalLink, Check, AlertTriangle } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { getCurrentUser, saveCreator, Creator } from "@/lib/storage";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

export default function Settings() {
  const navigate = useNavigate();
  const [user, setUser] = useState<Creator | null>(null);
  const [copied, setCopied] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    bio: "",
    substackUrl: "",
    welcomeMessage: "",
  });

  useEffect(() => {
    const currentUser = getCurrentUser();
    if (!currentUser) {
      navigate("/login");
      return;
    }
    setUser(currentUser);
    setFormData({
      name: currentUser.name,
      bio: currentUser.bio,
      substackUrl: currentUser.substackUrl,
      welcomeMessage: currentUser.welcomeMessage,
    });
  }, [navigate]);

  const handleSave = () => {
    if (!user) return;

    const updatedUser = {
      ...user,
      ...formData,
    };
    saveCreator(updatedUser);
    setUser(updatedUser);
    toast.success("Settings saved successfully!");
  };

  const handleCopyLink = () => {
    if (!user) return;
    navigator.clipboard.writeText(`${window.location.origin}/${user.username}`);
    setCopied(true);
    toast.success("Link copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  if (!user) return null;

  const publicUrl = `${window.location.origin}/${user.username}`;

  return (
    <DashboardLayout>
      <div className="max-w-2xl mx-auto">
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
              <a href={`/${user.username}`} target="_blank" rel="noopener noreferrer">
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
            </div>

            <div className="space-y-2">
              <Label htmlFor="username">Username</Label>
              <Input
                id="username"
                value={user.username}
                disabled
                className="opacity-60"
              />
              <p className="text-xs text-muted-foreground">
                Username cannot be changed
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="substackUrl">Substack URL</Label>
              <Input
                id="substackUrl"
                value={formData.substackUrl}
                onChange={(e) =>
                  setFormData({ ...formData, substackUrl: e.target.value })
                }
                placeholder="https://yourname.substack.com"
              />
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
              <p className="text-xs text-muted-foreground">
                This is shown to visitors on your public collaboration page
              </p>
            </div>

            <Button variant="gradient" onClick={handleSave} className="w-full">
              Save Changes
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
          <Button variant="destructive" className="w-full">
            Delete Account
          </Button>
        </motion.div>
      </div>
    </DashboardLayout>
  );
}
