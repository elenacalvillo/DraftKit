import { motion } from "framer-motion";
import { ChevronRight } from "lucide-react";

const steps = [
  {
    title: "Share Your Link",
    description: "Create your profile with a personal welcome message and get your booking page (draftkit.app/yourname)",
  },
  {
    title: "Guests Pick a Date",
    description: "Collaborators see your availability and share why they want to connect—on their terms",
  },
  {
    title: "Prep Your Conversation",
    description: "Get curated talking points based on what you both write about—so you can skip the small talk",
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
              className="relative text-center"
            >
              {/* Numbered Circle */}
              <div className="relative z-10 w-16 h-16 rounded-full bg-card border-2 border-border flex items-center justify-center mx-auto mb-6">
                <span className="text-sm font-semibold text-primary">
                  {String(index + 1).padStart(2, '0')}
                </span>
              </div>
              
              {/* Chevron Arrow - hidden on mobile, shown between steps on desktop */}
              {index < steps.length - 1 && (
                <div className="hidden md:block absolute top-8 -right-4 transform -translate-y-1/2 z-20">
                  <ChevronRight className="w-8 h-8 text-muted-foreground/40" />
                </div>
              )}
              
              <h3 className="font-medium text-lg text-foreground mb-2">{step.title}</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{step.description}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
