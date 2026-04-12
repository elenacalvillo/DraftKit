import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { ReceiptText, CreditCard, Coins, Bug, ShieldAlert, Mail, ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/layout/Navbar";
import { Footer } from "@/components/layout/Footer";

const sections = [
  {
    icon: CreditCard,
    title: "Subscriptions",
    text: "You can cancel your Pro plan anytime from your Membership page. We do not offer refunds for partial months or unused time once a billing cycle starts. Your Pro benefits remain active until the end of your current billing period."
  },
  {
    icon: Coins,
    title: "Writer's Credits",
    text: "All credit purchases are final. Once a credit is added to your account or used to open a room, it is non-refundable. Credits have no cash value and cannot be transferred between accounts."
  },
  {
    icon: Bug,
    title: "Technical Errors",
    text: "If a payment goes through but a bug prevents you from getting your credits or Pro access, we will fix it or issue a full refund. Contact us at hello@draftkit.app with your payment details and we'll resolve it promptly."
  },
  {
    icon: ShieldAlert,
    title: "Abuse",
    text: "Users banned for violating our Terms of Service are not eligible for refunds. This includes accounts suspended for spamming, harassment, or other conduct violations."
  },
  {
    icon: Mail,
    title: "Contact",
    text: "Questions about a charge or need help with a billing issue? Reach out at hello@draftkit.app and we'll get back to you within 48 hours."
  }
];

export default function RefundPolicy() {
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
            <ReceiptText className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            Refund <span className="gradient-text">Policy</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto mb-4">
            We keep it simple. Here is how we handle refunds.
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
          transition={{ delay: 0.6 }}
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
