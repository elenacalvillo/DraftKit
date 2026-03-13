import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight, Calendar, Users, CheckCircle, Heart } from "lucide-react";

export default function Demo() {
  return (
    <div className="min-h-screen gradient-bg">
      {/* Header */}
      <header className="fixed top-0 left-0 right-0 z-50 glass-card border-0 border-b">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="text-xl font-bold gradient-text">
            DraftKit
          </Link>
          <div className="flex items-center gap-4">
            <Button variant="ghost" asChild>
              <Link to="/login">Log In</Link>
            </Button>
            <Button variant="gradient" asChild>
              <Link to="/signup">Get Started</Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="pt-32 pb-20 px-6">
        <div className="max-w-4xl mx-auto">
          {/* Hero */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-16"
          >
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              How <span className="gradient-text">DraftKit</span> Works
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              A simple, beautiful way to connect with fellow creators—on your terms.
            </p>
          </motion.div>

          {/* Steps */}
          <div className="space-y-12">
            <Step
              number={1}
              icon={<Users className="w-6 h-6" />}
              title="Create Your Profile"
              description="Sign up and set up your creator profile with your name, bio, and a personal welcome message. Your unique username becomes your public booking link."
              delay={0.1}
            />
            <Step
              number={2}
              icon={<Calendar className="w-6 h-6" />}
              title="Set Your Availability"
              description="Use our beautiful calendar to mark when you're open to new connections. Block out busy days and set recurring availability."
              delay={0.2}
            />
            <Step
              number={3}
              icon={<Heart className="w-6 h-6" />}
              title="Share Your Link"
              description="Share your personalized booking page (draftkit.app/yourname) with potential collaborators. They'll see your availability and can tell you why they want to connect."
              delay={0.3}
            />
            <Step
              number={4}
              icon={<CheckCircle className="w-6 h-6" />}
              title="Start the Conversation"
              description="Review requests, get ready-to-use talking points based on both newsletters, and jump straight into meaningful conversations—no small talk needed."
              delay={0.4}
            />
          </div>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="text-center mt-16"
          >
            <Button variant="hero" size="xl" asChild>
              <Link to="/signup">
                Start Building Connections
                <ArrowRight className="w-5 h-5 ml-2" />
              </Link>
            </Button>
          </motion.div>
        </div>
      </main>
    </div>
  );
}

function Step({
  number,
  icon,
  title,
  description,
  delay,
}: {
  number: number;
  icon: React.ReactNode;
  title: string;
  description: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay }}
      className="flex gap-6 items-start"
    >
      <div className="flex-shrink-0">
        <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center text-primary-foreground">
          {icon}
        </div>
      </div>
      <div className="glass-card p-6 flex-1">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-sm font-medium text-primary">Step {number}</span>
        </div>
        <h3 className="text-xl font-semibold mb-2">{title}</h3>
        <p className="text-muted-foreground">{description}</p>
      </div>
    </motion.div>
  );
}
