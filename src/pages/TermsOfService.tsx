import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { FileText, User, Shield, CreditCard, Users, Coins, AlertTriangle, Scale, ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

const sections = [
  {
    icon: User,
    title: "Your Account",
    text: "You are responsible for your account and everything you write. We provide the room; you provide the content. Keep your login credentials secure—activity under your account is your responsibility."
  },
  {
    icon: Shield,
    title: "Ownership",
    text: "Your drafts belong to you. We do not claim any rights to your intellectual property. Anything you write, outline, or export through DraftKit remains yours."
  },
  {
    icon: CreditCard,
    title: "Payment",
    text: "We use Stripe to process payments. By subscribing or buying credits, you agree to Stripe's terms as well. All prices are in USD and charged at the time of purchase or renewal."
  },
  {
    icon: Users,
    title: "Subscriptions",
    text: "\"Pro\" gives you unlimited Writer's Rooms, custom themes, and premium features. \"Free\" accounts start with 3 collaboration slots. You can upgrade or cancel at any time from your Membership page."
  },
  {
    icon: Coins,
    title: "Writer's Credits",
    text: "Credits are used to open new rooms and unlock platform features. They are for platform use only and have no cash value. Credits are non-transferable between accounts."
  },
  {
    icon: AlertTriangle,
    title: "Conduct",
    text: "No spamming, harassment, or abusive behavior. We reserve the right to lock rooms, revoke access, or suspend accounts that violate these rules. Be the collaborator you'd want to work with."
  },
  {
    icon: Scale,
    title: "Liability",
    text: "We iterate fast. DraftKit is provided \"as is\" without warranties of any kind. We are not liable for data loss, business interruptions, or missed deadlines. Back up your important work regularly."
  }
];

export default function TermsOfService() {
  return (
    <div className="min-h-screen gradient-bg flex flex-col">
      <Navbar />

      <main className="container mx-auto px-6 py-16 max-w-4xl flex-1">
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to home
        </Link>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <div className="w-16 h-16 rounded-2xl gradient-primary mx-auto mb-6 flex items-center justify-center shadow-lg">
            <FileText className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Terms of <span className="gradient-text">Service</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-4">
            DraftKit is for building together. These are the rules.
          </p>
          <p className="text-sm text-muted-foreground">
            Last updated: April 12, 2026
          </p>
        </motion.div>

        <div className="space-y-8">
          {sections.map((section, index) => (
            <motion.div
              key={section.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="glass-card p-8"
            >
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <section.icon className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold mb-2">{section.title}</h2>
                  <p className="text-muted-foreground">{section.text}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.7 }}
          className="glass-card p-8 mt-8"
        >
          <h2 className="text-2xl font-bold mb-4">Changes to These Terms</h2>
          <p className="text-muted-foreground">
            We may update these Terms of Service from time to time. If we make significant changes, we will notify you by email or by posting a notice on our website before the changes take effect.
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8 }}
          className="text-center mt-16"
        >
          <h3 className="text-2xl font-bold mb-4">Ready to collaborate with confidence?</h3>
          <p className="text-muted-foreground mb-6">
            Join creators who trust DraftKit with their collaborations.
          </p>
          <Button asChild variant="hero" size="lg">
            <Link to="/signup">
              Create Your Booking Page
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </Button>
        </motion.div>
      </main>

      <Footer />
    </div>
  );
}
