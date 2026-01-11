import { motion } from "framer-motion";
import { Link2, CalendarCheck, Lightbulb } from "lucide-react";

const steps = [
  {
    icon: <Link2 className="w-6 h-6" />,
    title: "Share Your Link",
    description: "Create your profile and get a personalized booking page (collabstack.app/yourname)",
  },
  {
    icon: <CalendarCheck className="w-6 h-6" />,
    title: "Guests Pick a Date",
    description: "Collaborators see your calendar and request available dates",
  },
  {
    icon: <Lightbulb className="w-6 h-6" />,
    title: "AI Suggests Topics",
    description: "Both newsletters are analyzed to generate perfect collaboration ideas",
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
            From link to collaboration in three simple steps
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
                {/* Step number */}
                <div className="w-20 h-20 rounded-2xl gradient-primary flex items-center justify-center text-primary-foreground mb-6 shadow-glow">
                  {step.icon}
                </div>
                
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
