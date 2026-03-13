import { motion } from "framer-motion";
import { Users, Calendar, Heart, CheckCircle } from "lucide-react";

const steps = [
  {
    number: "01",
    icon: <Users className="w-7 h-7" />,
    title: "Create Your Profile",
    description:
      "Sign up and set up your creator profile. When you invite a partner to join, you both earn a collaboration credit toward your next growth milestone.",
  },
  {
    number: "02",
    icon: <Calendar className="w-7 h-7" />,
    title: "Set Your Availability",
    description:
      "Use our beautiful calendar to mark when you're open to new connections. Block out busy days and set recurring availability.",
  },
  {
    number: "03",
    icon: <Heart className="w-7 h-7" />,
    title: "Share Your Link",
    description:
      "Share your personalized booking page with potential collaborators. They'll see your availability and can tell you why they want to connect.",
  },
  {
    number: "04",
    icon: <CheckCircle className="w-7 h-7" />,
    title: "Start the Conversation",
    description:
      "Review requests, get ready-to-use talking points based on both newsletters, and jump straight into meaningful conversations—no small talk needed.",
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
            Four simple steps to meaningful creator collaborations.
          </p>
        </motion.div>

        <div className="space-y-6">
          {steps.map((step, index) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="glass-card p-6 flex gap-5 border-l-2 border-primary/40 hover:border-primary/50 transition-colors h-full"
            >
              <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center text-primary-foreground shrink-0">
                {step.icon}
              </div>

              <div>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-lg font-bold text-primary">{step.number}</span>
                  <h3 className="font-semibold text-lg text-foreground">{step.title}</h3>
                </div>
                <p className="text-muted-foreground text-sm leading-relaxed">{step.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
