import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";

const principles = [
  {
    question: "Does my collaborator need to pay?",
    answer:
      "No. We run on the Meeting Room model. You own the house (Pro), so your guests are always welcome for free. They will never hit a paywall just to help you write.",
  },
  {
    question: "How is this better than a Google Doc?",
    answer:
      "Google Docs are where drafts go to die. DraftKit is where they go to get finished. We automate the research capture, the SMART draft, and the final export. It is a dedicated engine, not a blank sheet of paper.",
  },
  {
    question: "Will the AI sound like me?",
    answer:
      "DraftKit uses Prompt-Led Product principles. The AI does not write for you — it writes with you, using the research your guest provided to stay grounded in fact and tone.",
  },
  {
    question: "Is this just another AI content factory?",
    answer:
      "Actually, it's the opposite. DraftKit is built for human-to-human partnerships that AI cannot replicate. We just automate the boring chores so you can focus on the relationship.",
  },
  {
    question: "Why not just use the Substack Recommendation engine?",
    answer:
      "Because the data shows that for writers under 1k subs, recommendations drive less than 5% of growth. You need a system to reach new audiences actively.",
  },
  {
    question: "What if my Substack doesn't show up in search yet?",
    answer:
      "It doesn't have to. DraftKit uses direct metadata resolution and archive indexing. If your publication is live on the web, we can find it, connect it, and start growing it immediately.",
  },
  {
    question: "How do I get more collaboration credits?",
    answer:
      "Simple—invite your friends. When a writer you invite joins DraftKit, we give both of you a free collaboration credit. It's our way of saying thanks for helping the community grow.",
  },
];

export function FeatureRoadmapSection() {
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
          <h2 className="text-3xl md:text-4xl font-bold mb-4">The honest answers</h2>
        </motion.div>

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-12">
          {principles.map((principle, index) => (
            <motion.div
              key={principle.question}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.12 }}
              className="glass-card p-6"
            >
              <h3 className="font-semibold text-foreground mb-3 leading-snug">"{principle.question}"</h3>
              <p className="text-muted-foreground text-sm leading-relaxed">{principle.answer}</p>
            </motion.div>
          ))}
        </div>

      </div>
    </section>
  );
}
