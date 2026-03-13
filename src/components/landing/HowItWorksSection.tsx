import { motion } from "framer-motion";
import { Send, Sparkles, FileText, Trophy } from "lucide-react";

const steps = [
  {
    number: "01",
    icon: <Send className="w-7 h-7" />,
    title: "The Request",
    description:
      "Send a professional front-door invite that replaces messy DMs. When you invite a new partner to the platform, you both earn a collaboration credit.",
  },
  {
    number: "02",
    icon: <Sparkles className="w-7 h-7" />,
    title: "The SMART Draft",
    description:
      "Start with a structure that's already 50% finished. No more blank pages.",
  },
  {
    number: "03",
    icon: <FileText className="w-7 h-7" />,
    title: "The Shared Workspace",
    description:
      'One shared room for the partnership and the draft. No more "which version is this?" email threads.',
  },
  {
    number: "04",
    icon: <Trophy className="w-7 h-7" />,
    title: "The Milestone",
    description:
      "Export to Substack with one click. No more copy-paste or broken links.",
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
          <h2 className="text-3xl md:text-4xl font-bold mb-4">Four steps from idea to published</h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            DraftKit handles the research, the writing start, and the celebration. You handle the creativity.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-6">
          {steps.map((step, index) => (
            <motion.div
              key={step.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.12 }}
              className="glass-card p-6 flex gap-5 border-l-2 border-primary/40 h-full"
            >
              {/* Icon */}
              <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center text-primary-foreground shrink-0">
                {step.icon}
              </div>

              <div>
                {/* Number + title */}
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
