import { motion } from "framer-motion";

export function DirectDiscoveryCard() {
  return (
    <section className="py-20 px-6">
      <div className="max-w-3xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="glass-card p-10 md:p-14 text-center"
        >
          {/* Animated A→B graphic */}
          <div className="flex justify-center mb-8">
            <svg width="280" height="100" viewBox="0 0 280 100" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Cloud shape (Search Index) - faded */}
              <motion.g
                initial={{ opacity: 0.5 }}
                whileInView={{ opacity: 0.15 }}
                viewport={{ once: true }}
                transition={{ duration: 1.2, delay: 0.8 }}
              >
                <ellipse cx="140" cy="45" rx="50" ry="28" className="fill-muted stroke-border" strokeWidth="1" />
                <text x="140" y="48" textAnchor="middle" className="fill-muted-foreground" fontSize="9" fontFamily="monospace">
                  Search Index
                </text>
              </motion.g>

              {/* Point A */}
              <motion.circle
                cx="40" cy="75" r="8"
                className="fill-primary"
                initial={{ scale: 0 }}
                whileInView={{ scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: 0.2 }}
              />
              <text x="40" y="95" textAnchor="middle" className="fill-foreground" fontSize="11" fontWeight="600">A</text>

              {/* Point B */}
              <motion.circle
                cx="240" cy="75" r="8"
                className="fill-primary"
                initial={{ scale: 0 }}
                whileInView={{ scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.3, delay: 0.4 }}
              />
              <text x="240" y="95" textAnchor="middle" className="fill-foreground" fontSize="11" fontWeight="600">B</text>

              {/* Direct line A→B */}
              <motion.line
                x1="50" y1="75" x2="230" y2="75"
                className="stroke-primary"
                strokeWidth="3"
                strokeLinecap="round"
                initial={{ pathLength: 0 }}
                whileInView={{ pathLength: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.8, delay: 0.6, ease: "easeOut" }}
              />

              {/* Arrowhead */}
              <motion.polygon
                points="228,69 240,75 228,81"
                className="fill-primary"
                initial={{ opacity: 0 }}
                whileInView={{ opacity: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.2, delay: 1.3 }}
              />
            </svg>
          </div>

          <h2 className="text-2xl md:text-3xl font-bold text-foreground mb-4">
            Find new voices to grow with.
          </h2>
          <p className="text-muted-foreground leading-relaxed max-w-xl mx-auto">
            The best way to grow is to find the right partners early. We help you discover new writers
            and fresh audiences to collaborate with. If someone has a publication online, you can find
            them here and start building something together today.
          </p>
        </motion.div>
      </div>
    </section>
  );
}
