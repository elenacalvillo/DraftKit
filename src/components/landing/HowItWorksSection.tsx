import { motion } from "framer-motion";
import { Search, Send, Zap, Users, Gift, Trophy } from "lucide-react";

const pillars = [
  {
    number: "01",
    icon: <Search className="w-7 h-7" />,
    title: "Smart Discovery",
    description:
      "Find the right voices even when standard search fails. We look at the source to find collaborators ready to grow with you.",
  },
  {
    number: "02",
    icon: <Send className="w-7 h-7" />,
    title: "The Front Door",
    description:
      "Replace messy DMs with a professional request page. When you invite a partner to join, you both earn a collaboration credit.",
  },
  {
    number: "03",
    icon: <Zap className="w-7 h-7" />,
    title: "The Smart Draft",
    description:
      "Start with a workspace that is already 50 percent finished. We pull the research and context so you never start from zero.",
  },
  {
    number: "04",
    icon: <Users className="w-7 h-7" />,
    title: "The Shared Room",
    description:
      "One home for the draft and the conversation. Eliminate email threads and messy document permissions forever.",
  },
  {
    number: "05",
    icon: <Gift className="w-7 h-7" />,
    title: "The Growth Loop",
    description:
      "DraftKit grows when you grow. Earn extra collaboration credits for every writer you bring into the community.",
  },
  {
    number: "06",
    icon: <Trophy className="w-7 h-7" />,
    title: "The Milestone",
    description:
      "Export to Substack in one click with all formatting preserved. No more copy pasting or fixing broken links.",
  },
];

export function HowItWorksSection() {
  return (
    <section className="py-24 px-6 bg-muted/30">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">How we break the loneliness wall</h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            We automate the busywork so you can focus on the relationship.
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {pillars.map((pillar, index) => (
            <motion.div
              key={pillar.title}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.1 }}
              className="glass-card p-6 flex gap-5 border-l-2 border-primary/40 hover:border-primary/50 transition-colors h-full"
            >
              <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center text-primary-foreground shrink-0">
                {pillar.icon}
              </div>

              <div>
                <div className="flex items-baseline gap-2 mb-2">
                  <span className="text-lg font-bold text-primary">{pillar.number}</span>
                  <h3 className="font-semibold text-lg text-foreground">{pillar.title}</h3>
                </div>
                <p className="text-muted-foreground text-sm leading-relaxed">{pillar.description}</p>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
