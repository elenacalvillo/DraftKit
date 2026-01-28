import { motion } from "framer-motion";
import { useState } from "react";
import { Calendar, BookOpen, Users, Check, Clock, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

const features = [
  {
    icon: <Calendar className="w-5 h-5" />,
    title: "Collaborative Scheduling",
    description: "Beautiful calendar-based booking for newsletter collaborations",
    status: "live" as const,
  },
  {
    icon: <BookOpen className="w-5 h-5" />,
    title: "SMART Conversation Prep",
    description: "Curated talking points based on what you both write—not generated content, just research done for you",
    status: "live" as const,
  },
  {
    icon: <Users className="w-5 h-5" />,
    title: "Creator Directory",
    description: "Discover new partners to collaborate with",
    status: "coming" as const,
  },
];

export function FeatureRoadmapSection() {
  const [email, setEmail] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleNotify = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;

    setIsLoading(true);
    
    // Store email in a simple way - we'll just track it in analytics
    // In a real app, you'd store this in a waitlist table
    try {
      // Track the waitlist signup as an analytics event
      await supabase.from('analytics_events').insert({
        event_type: 'directory_waitlist_signup',
        event_data: { email },
      });
      
      toast.success("You're on the list! We'll notify you when the Creator Directory launches.");
      setEmail("");
    } catch (error) {
      toast.error("Something went wrong. Please try again.");
    }
    
    setIsLoading(false);
  };

  return (
    <section className="py-24 px-6">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Feature Roadmap</h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            What's live today and what's coming next
          </p>
        </motion.div>

        <div className="space-y-4 mb-12">
          {features.map((feature, index) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, x: -20 }}
              whileInView={{ opacity: 1, x: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.4, delay: index * 0.1 }}
              className="glass-card p-6 flex items-center gap-4"
            >
              <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                feature.status === "live" 
                  ? "bg-success/20 text-success" 
                  : "bg-primary/20 text-primary"
              }`}>
                {feature.icon}
              </div>
              
              <div className="flex-1">
                <h3 className="font-semibold text-lg">{feature.title}</h3>
                <p className="text-muted-foreground text-sm">{feature.description}</p>
              </div>
              
              <div className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium ${
                feature.status === "live" 
                  ? "bg-success/10 text-success" 
                  : "bg-primary/10 text-primary"
              }`}>
                {feature.status === "live" ? (
                  <>
                    <Check className="w-4 h-4" />
                    Live
                  </>
                ) : (
                  <>
                    <Clock className="w-4 h-4" />
                    Coming Soon
                  </>
                )}
              </div>
            </motion.div>
          ))}
        </div>

        {/* Waitlist CTA */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="glass-card p-8 text-center"
        >
          <Users className="w-10 h-10 text-primary mx-auto mb-4" />
          <h3 className="text-xl font-semibold mb-2">Be the first to join the Creator Directory</h3>
          <p className="text-muted-foreground mb-6 max-w-md mx-auto">
            Get notified when the directory launches and become discoverable by other Substack creators
          </p>
          
          <form onSubmit={handleNotify} className="flex gap-3 max-w-md mx-auto">
            <Input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1"
              required
            />
            <Button type="submit" variant="hero" disabled={isLoading}>
              {isLoading ? "..." : "Notify Me"}
              <ArrowRight className="w-4 h-4 ml-2" />
            </Button>
          </form>
        </motion.div>
      </div>
    </section>
  );
}
