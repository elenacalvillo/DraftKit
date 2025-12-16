import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight, Calendar, Users, Sparkles } from "lucide-react";

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
            <Sparkles className="w-4 h-4" />
            <span className="text-sm font-medium">The future of creator collaboration</span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-5xl md:text-7xl font-bold tracking-tight mb-6"
          >
            Schedule Collabs
            <br />
            <span className="gradient-text">Effortlessly</span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-xl text-muted-foreground max-w-2xl mx-auto mb-12"
          >
            The beautiful way to manage collaboration requests. Share your availability, 
            receive requests, and connect with creators — all in one delightful experience.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
            className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-20"
          >
            <Button variant="hero" size="xl" asChild>
              <Link to="/signup">
                Start Organizing Collaborations
                <ArrowRight className="w-5 h-5 ml-2" />
              </Link>
            </Button>
            <Button variant="glass" size="lg" asChild>
              <Link to="/demo">See How It Works</Link>
            </Button>
          </motion.div>

          {/* Feature Cards */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.4 }}
            className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto"
          >
            <FeatureCard
              icon={<Calendar className="w-6 h-6" />}
              title="Visual Calendar"
              description="Set your availability with a beautiful, interactive calendar interface"
              delay={0.5}
            />
            <FeatureCard
              icon={<Users className="w-6 h-6" />}
              title="Manage Requests"
              description="Review, approve, or decline collaboration requests with ease"
              delay={0.6}
            />
            <FeatureCard
              icon={<Sparkles className="w-6 h-6" />}
              title="Your Public Page"
              description="Share a stunning booking page that matches your brand"
              delay={0.7}
            />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function FeatureCard({
  icon,
  title,
  description,
  delay,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay }}
      whileHover={{ y: -5 }}
      className="glass-card p-6 hover-lift cursor-default"
    >
      <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center text-primary-foreground mb-4 mx-auto">
        {icon}
      </div>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground text-sm">{description}</p>
    </motion.div>
  );
}
