import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight, Zap, Send, Sparkles, FileText, Trophy } from "lucide-react";
import { DraftKitLogo } from "@/components/icons/DraftKitLogo";

const steps = [
  {
    number: "01",
    icon: <Send className="w-4 h-4" />,
    title: "The Pitch",
    description: "Structured requests, not cold DMs",
  },
  {
    number: "02",
    icon: <Sparkles className="w-4 h-4" />,
    title: "The SMART Draft",
    description: "Start at 80% done, not zero",
  },
  {
    number: "03",
    icon: <FileText className="w-4 h-4" />,
    title: "The Workspace",
    description: "A meeting room for two",
  },
  {
    number: "04",
    icon: <Trophy className="w-4 h-4" />,
    title: "The Milestone",
    description: "Export and celebrate the win",
  },
];

export function HeroSection() {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden gradient-bg">
      {/* Animated background elements */}
      <div className="absolute inset-0 overflow-hidden">
        <motion.div
          animate={{
            scale: [1, 1.2, 1],
            rotate: [0, 180, 360],
          }}
          transition={{
            duration: 20,
            repeat: Infinity,
            ease: "linear",
          }}
          className="absolute -top-1/2 -right-1/2 w-full h-full rounded-full bg-gradient-to-br from-primary/10 to-transparent blur-3xl"
        />
        <motion.div
          animate={{
            scale: [1.2, 1, 1.2],
            rotate: [360, 180, 0],
          }}
          transition={{
            duration: 25,
            repeat: Infinity,
            ease: "linear",
          }}
          className="absolute -bottom-1/2 -left-1/2 w-full h-full rounded-full bg-gradient-to-tr from-accent/10 to-transparent blur-3xl"
        />
      </div>

      <div className="relative z-10 max-w-6xl mx-auto px-6 pt-32 pb-20">
        <div className="text-center">
          {/* Badge */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10 text-primary mb-8"
          >
            <Zap className="w-4 h-4" />
            <span className="text-sm font-medium">Built for creators who ship, not just schedule</span>
          </motion.div>

          {/* Logo mark */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.075 }}
            className="flex justify-center mb-6"
          >
            <DraftKitLogo size={72} />
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-4xl md:text-6xl font-bold tracking-tight mb-6"
          >
            Stop chasing drafts.
            <br />
            <span className="gradient-text">Start shipping together.</span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-xl text-muted-foreground max-w-2xl mx-auto mb-12"
          >
            One link to handle the pitch, the research, and the writing.
            DraftKit is the shared workspace built for creators who value their time — and their collaborators.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-20"
          >
            <Link to="/signup">
              <Button variant="hero" size="xl">
                Start Drafting — It's Free
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
            <Link to="/demo">
              <Button variant="glass" size="lg">See a Demo Workspace</Button>
            </Link>
          </motion.div>

          {/* Product Loop Preview */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.4 }}
            className="grid grid-cols-2 md:grid-cols-4 gap-3 max-w-4xl mx-auto"
          >
            {steps.map((step, index) => (
              <div key={step.number} className="relative flex items-stretch">
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.5 + index * 0.1 }}
                  className="glass-card p-4 text-left flex-1"
                >
                  {/* Number + Icon row */}
                  <div className="flex items-center gap-2 mb-3">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full gradient-primary text-primary-foreground text-xs font-bold shrink-0">
                      {step.number}
                    </span>
                    <span className="text-primary">{step.icon}</span>
                  </div>
                  <p className="font-semibold text-sm text-foreground leading-tight mb-1">{step.title}</p>
                  <p className="text-xs text-muted-foreground leading-snug">{step.description}</p>
                </motion.div>

                {/* Arrow connector — desktop only, not after last item */}
                {index < steps.length - 1 && (
                  <div className="hidden md:flex items-center justify-center absolute -right-2 top-1/2 -translate-y-1/2 z-10">
                    <ArrowRight className="w-4 h-4 text-muted-foreground/40" />
                  </div>
                )}
              </div>
            ))}
          </motion.div>
        </div>
      </div>
    </section>
  );
}
