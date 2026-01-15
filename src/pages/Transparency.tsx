import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { Shield, BarChart3, Brain, ArrowRight, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Navbar } from "@/components/layout/Navbar";

const sections = [
  {
    icon: Shield,
    title: "Data Sovereignty",
    description: "Your Data is Yours",
    points: [
      {
        title: "Enterprise-grade Security",
        text: "We use Row Level Security (RLS) to ensure that your requests, drafts, and settings are accessible only to you and the people you choose to collaborate with."
      },
      {
        title: "No Third-Party Selling",
        text: "We're in the business of building collaboration tools, not selling data. Your email and newsletter analytics are never shared with advertisers."
      }
    ]
  },
  {
    icon: BarChart3,
    title: "Tracking & Growth Metrics",
    description: "Purposeful Analytics",
    points: [
      {
        title: "Functional Events Only",
        text: "To make CollabStack better, we track functional events like booking clicks and draft exports—nothing more."
      },
      {
        title: "Anonymous Improvement",
        text: "This data is used solely to understand which features are helpful and where we can reduce friction in your workflow."
      },
      {
        title: "No Fingerprinting",
        text: "We use session-based tracking to improve the site experience without building a personal profile of your browsing habits."
      }
    ]
  },
  {
    icon: Brain,
    title: "AI Ethics & Content",
    description: "Respectful Intelligence",
    points: [
      {
        title: "Public Data Only",
        text: "Our AI only reads the public RSS feeds you provide to generate collaboration ideas—nothing private."
      },
      {
        title: "No Training on Your Drafts",
        text: "The drafts generated for your collaborations are private. We do not use your unique voice or unpublished ideas to train our global AI models."
      }
    ]
  }
];

export default function Transparency() {
  return (
    <div className="min-h-screen gradient-bg">
      <Navbar />
      
      <main className="container mx-auto px-6 py-16 max-w-4xl">
        {/* Back link */}
        <Link
          to="/"
          className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground mb-8 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to home
        </Link>

        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-16"
        >
          <div className="w-16 h-16 rounded-2xl gradient-primary mx-auto mb-6 flex items-center justify-center shadow-lg">
            <Shield className="w-8 h-8 text-primary-foreground" />
          </div>
          <h1 className="text-4xl md:text-5xl font-bold mb-4">
            The CollabStack{" "}
            <span className="gradient-text">Privacy Promise</span>
          </h1>
          <p className="text-xl text-muted-foreground max-w-2xl mx-auto">
            We believe transparency is the foundation of trust. Here's exactly how we handle your data.
          </p>
        </motion.div>

        {/* Sections */}
        <div className="space-y-8">
          {sections.map((section, index) => (
            <motion.div
              key={section.title}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="glass-card p-8"
            >
              <div className="flex items-start gap-4 mb-6">
                <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <section.icon className="w-6 h-6 text-primary" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold">{section.title}</h2>
                  <p className="text-muted-foreground">{section.description}</p>
                </div>
              </div>
              
              <div className="space-y-4 ml-16">
                {section.points.map((point, pointIndex) => (
                  <div key={pointIndex} className="border-l-2 border-primary/20 pl-4">
                    <h3 className="font-semibold text-foreground">{point.title}</h3>
                    <p className="text-muted-foreground text-sm mt-1">{point.text}</p>
                  </div>
                ))}
              </div>
            </motion.div>
          ))}
        </div>

        {/* CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-center mt-16"
        >
          <h3 className="text-2xl font-bold mb-4">Ready to collaborate with confidence?</h3>
          <p className="text-muted-foreground mb-6">
            Join creators who trust CollabStack with their collaborations.
          </p>
          <Button asChild variant="hero" size="lg">
            <Link to="/signup">
              Create Your Booking Page
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </Button>
        </motion.div>
      </main>
    </div>
  );
}
