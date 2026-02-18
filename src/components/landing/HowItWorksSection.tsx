import { motion } from "framer-motion";
import { Send, Sparkles, FileText, Trophy } from "lucide-react";

const steps = [
  {
    number: "01",
    icon: <Send className="w-6 h-6" />,
    title: "The Request",
    description:
      'Send one link. Your guest fills out a structured pitch with real research — not "let me know what you want to talk about."',
  },
  {
    number: "02",
    icon: <Sparkles className="w-6 h-6" />,
    title: "The SMART Draft",
    description:
      "The AI takes their research and generates a 1,000-word starting point in your tone. You start at 80% done, not zero.",
  },
  {
    number: "03",
    icon: <FileText className="w-6 h-6" />,
    title: "The Shared Workspace",
    description:
      'A distraction-free "meeting room" for two. No sidebars. No small talk. Just the text.',
  },
  {
    number: "04",
    icon: <Trophy className="w-6 h-6" />,
    title: "The Milestone",
    description:
      "Export to Substack or Word in one click. A retrospective banner closes the loop and celebrates the win.",
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
              className="glass-card p-6 flex gap-5 border-l-2 border-primary/40"
            >
              {/* Icon */}
              <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center text-primary-foreground shrink-0">
                {step.icon}
              </div>

              <div>
                {/* Number + title */}
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-xs font-bold text-primary/60 tracking-widest">{step.number}</span>
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
