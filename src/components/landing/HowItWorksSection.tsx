import { motion } from "framer-motion";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { teamProfiles } from "@/data/team-profiles";

const steps = [
  {
    profile: teamProfiles[3], // Raghav
    title: "Share Your Link",
    description: "Create your profile with a personal welcome message and get your booking page (collabstack.app/yourname)",
  },
  {
    profile: teamProfiles[1], // Stef
    title: "Guests Pick a Date",
    description: "Collaborators see your availability and share why they want to connect—on their terms",
  },
  {
    profile: teamProfiles[2], // Cristina
    title: "Prep Your Conversation",
    description: "Get AI-curated talking points based on what you both write about—so you can skip the small talk",
  },
];

export function HowItWorksSection() {
  return (
    <section className="py-24 px-6 bg-muted/30">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">How It Works</h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            From first hello to meaningful conversation in three simple steps
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-8">
          {steps.map((step, index) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.15 }}
              className="relative"
            >
              {/* Connector line */}
              {index < steps.length - 1 && (
                <div className="hidden md:block absolute top-10 left-1/2 w-full h-0.5 bg-gradient-to-r from-primary/50 to-primary/20" />
              )}
              
              <div className="relative z-10 flex flex-col items-center text-center">
                {/* Profile Avatar */}
                <Avatar className="w-20 h-20 mb-6 border-3 border-primary/30 shadow-lg ring-4 ring-primary/10">
                  <AvatarImage src={step.profile.image} alt={step.profile.name} className="object-cover" />
                  <AvatarFallback className="text-xl font-medium">{step.profile.initials}</AvatarFallback>
                </Avatar>
                
                <span className="text-sm font-medium text-primary mb-2">Step {index + 1}</span>
                <h3 className="text-xl font-semibold mb-3">{step.title}</h3>
                <p className="text-muted-foreground">{step.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
