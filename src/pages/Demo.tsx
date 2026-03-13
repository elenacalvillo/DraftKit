import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight, Search, Send, Zap, Users, Gift, Trophy } from "lucide-react";

const pillars = [
  {
    number: "01",
    icon: <Search className="w-7 h-7" />,
    title: "Smart Discovery",
    description:
      "Find the right voices even when standard search fails. We look at the source to find collaborators ready to grow with you.",
  },
  {
    number: "02",
    icon: <Send className="w-7 h-7" />,
    title: "The Front Door",
    description:
      "Replace messy DMs with a professional request page. Your invite earns both of you a collaboration credit toward your next growth milestone.",
  },
  {
    number: "03",
    icon: <Zap className="w-7 h-7" />,
    title: "The Smart Draft",
    description:
      "Start your collaboration with an AI-powered foundation. We automate the ideation phase so you can focus on high-value writing.",
  },
  {
    number: "04",
    icon: <Users className="w-7 h-7" />,
    title: "The Shared Room",
    description:
      "A dedicated workspace for your team. Manage edits, feedback, and final approvals in one centralized location.",
  },
  {
    number: "05",
    icon: <Gift className="w-7 h-7" />,
    title: "The Growth Loop",
    description:
      "DraftKit grows when you grow. Earn extra credits for every writer you bring into the community to scale your network.",
  },
  {
    number: "06",
    icon: <Trophy className="w-7 h-7" />,
    title: "The Milestone",
    description:
      "Finalize and ship your post instantly. Preserving your layout kills the manual friction that causes most writers to quit.",
  },
];

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
        <div className="max-w-6xl mx-auto">
          {/* Hero */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-center mb-16"
          >
            <h1 className="text-4xl md:text-5xl font-bold mb-4">
              How we break the <span className="gradient-text">loneliness wall</span>
            </h1>
            <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
              We automate the busywork so you can focus on the relationship.
            </p>
          </motion.div>

          {/* 6-Pillar Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pillars.map((pillar, index) => (
              <motion.div
                key={pillar.title}
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: index * 0.1 }}
                className="glass-card p-6 flex gap-5 border-l-2 border-primary/40 hover:border-primary/50 transition-colors h-full"
              >
                <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center text-primary-foreground shrink-0">
                  {pillar.icon}
                </div>

                <div>
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-lg font-bold text-primary">{pillar.number}</span>
                    <h3 className="font-semibold text-lg text-foreground">{pillar.title}</h3>
                  </div>
                  <p className="text-muted-foreground text-sm leading-relaxed">{pillar.description}</p>
                </div>
              </motion.div>
            ))}
          </div>

          {/* CTA */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7 }}
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
