import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { ArrowRight, Heart } from "lucide-react";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { teamProfiles } from "@/data/team-profiles";

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
            <Heart className="w-4 h-4" />
            <span className="text-sm font-medium">Built for creators who care about connection</span>
          </motion.div>

          {/* Headline */}
          <motion.h1
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.1 }}
            className="text-4xl md:text-6xl font-bold tracking-tight mb-6"
          >
            The collaborative engine
            <br />
            <span className="gradient-text">for your next great post</span>
          </motion.h1>

          {/* Subheadline */}
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="text-xl text-muted-foreground max-w-2xl mx-auto mb-12"
          >
            Sync schedules, find the right collaborator, and get a ready-to-publish 
            plan in seconds. No more awkward DM chains.
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
                Create Your Booking Page
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            </Link>
            <Link to="/demo">
              <Button variant="glass" size="lg">See How It Works</Button>
            </Link>
          </motion.div>

          {/* Feature Cards */}
          <motion.div
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.4 }}
            className="grid md:grid-cols-3 gap-6 max-w-4xl mx-auto"
          >
            <FeatureCard
              image={teamProfiles[0].image}
              name={teamProfiles[0].name}
              initials={teamProfiles[0].initials}
              title="Your Calendar, Your Rules"
              description="Control when you're open to new connections with a simple, beautiful interface"
              delay={0.5}
            />
            <FeatureCard
              image={teamProfiles[1].image}
              name={teamProfiles[1].name}
              initials={teamProfiles[1].initials}
              title="Personal Pitches Only"
              description="Every request includes a space for collaborators to share their 'why'—no cold DMs"
              delay={0.6}
            />
            <FeatureCard
              image={teamProfiles[2].image}
              name={teamProfiles[2].name}
              initials={teamProfiles[2].initials}
              title="Drafting Playbooks"
              description="Share your interview formats or writing guidelines automatically when a request is approved"
              delay={0.7}
            />
          </motion.div>
        </div>
      </div>
    </section>
  );
}

function FeatureCard({
  image,
  name,
  initials,
  title,
  description,
  delay,
}: {
  image: string;
  name: string;
  initials: string;
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
      <Avatar className="w-16 h-16 mx-auto mb-4 border-2 border-primary/20 shadow-lg">
        <AvatarImage src={image} alt={name} className="object-cover" />
        <AvatarFallback className="text-lg font-medium">{initials}</AvatarFallback>
      </Avatar>
      <h3 className="text-lg font-semibold mb-2">{title}</h3>
      <p className="text-muted-foreground text-sm">{description}</p>
    </motion.div>
  );
}
