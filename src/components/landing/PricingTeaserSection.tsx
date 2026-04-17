import { motion } from "framer-motion";
import { Check } from "lucide-react";
import { Link } from "react-router-dom";

const tiers = [
  {
    name: "Free",
    price: "$0",
    cadence: "forever",
    description: "Perfect for trying your first few collabs.",
    features: [
      "3 collaboration credits",
      "+1 credit for every writer you invite",
      "Full Writer's Room access",
      "Public booking page",
    ],
    highlighted: false,
  },
  {
    name: "Pro",
    price: "$14.99",
    cadence: "/ month",
    description: "For writers shipping collabs every week.",
    features: [
      "Unlimited collaborations",
      "Custom booking-page branding",
      "DOCX export",
      "Priority support",
    ],
    highlighted: true,
  },
];

export function PricingTeaserSection() {
  return (
    <section className="py-24 px-6">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-12"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-3">Simple, honest pricing</h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Start free. Upgrade when collabs become a weekly habit.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-2 gap-5">
          {tiers.map((tier, i) => (
            <motion.div
              key={tier.name}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: i * 0.1 }}
              className={`glass-card p-7 flex flex-col ${
                tier.highlighted ? "border-2 border-primary/40 shadow-lg" : "border border-border/50"
              }`}
            >
              <div className="flex items-baseline justify-between mb-1">
                <h3 className="text-xl font-semibold text-foreground">{tier.name}</h3>
                {tier.highlighted && (
                  <span className="text-xs uppercase tracking-wider text-primary font-medium">
                    Most popular
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-1 mb-2">
                <span className="text-3xl font-bold text-foreground">{tier.price}</span>
                <span className="text-sm text-muted-foreground">{tier.cadence}</span>
              </div>
              <p className="text-sm text-muted-foreground mb-5">{tier.description}</p>
              <ul className="space-y-2.5 mb-6 flex-1">
                {tier.features.map((f) => (
                  <li key={f} className="flex items-start gap-2 text-sm text-foreground/90">
                    <Check className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </motion.div>
          ))}
        </div>

        <p className="text-center text-sm text-muted-foreground mt-8">
          See full details on the{" "}
          <Link to="/dashboard/subscription" className="text-primary hover:underline">
            Membership page
          </Link>{" "}
          after sign-up.
        </p>
      </div>
    </section>
  );
}
