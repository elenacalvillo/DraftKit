import { motion } from "framer-motion";

const outerDots = Array.from({ length: 10 }, (_, i) => {
  const angle = (i * 360) / 10 - 90;
  const rad = (angle * Math.PI) / 180;
  const r = 80;
  return { x: 140 + r * Math.cos(rad), y: 100 + r * Math.sin(rad) };
});

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
          {/* Network graphic */}
          <div className="flex justify-center mb-8">
            <svg width="280" height="200" viewBox="0 0 280 200" fill="none" xmlns="http://www.w3.org/2000/svg">
              {/* Connection lines */}
              {outerDots.map((dot, i) => (
                <motion.line
                  key={`line-${i}`}
                  x1="140" y1="100" x2={dot.x} y2={dot.y}
                  stroke="hsl(var(--primary))"
                  strokeWidth="2"
                  strokeLinecap="round"
                  initial={{ pathLength: 0, opacity: 0 }}
                  whileInView={{ pathLength: 1, opacity: 0.6 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.5, delay: 0.4 + i * 0.08 }}
                />
              ))}

              {/* Center dot with glow */}
              <motion.circle
                cx="140" cy="100" r="14"
                fill="hsl(var(--primary))"
                initial={{ scale: 0 }}
                whileInView={{ scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: 0.1 }}
              />
              <motion.circle
                cx="140" cy="100" r="22"
                fill="hsl(var(--primary))"
                opacity="0.15"
                initial={{ scale: 0 }}
                whileInView={{ scale: 1 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: 0.2 }}
              />

              {/* Outer dots */}
              {outerDots.map((dot, i) => (
                <motion.circle
                  key={`dot-${i}`}
                  cx={dot.x} cy={dot.y} r="7"
                  fill="hsl(var(--primary))"
                  opacity="0.7"
                  initial={{ scale: 0 }}
                  whileInView={{ scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ duration: 0.3, delay: 0.6 + i * 0.06 }}
                />
              ))}
            </svg>
          </div>

          {/* Growth Tip badge */}
          <div className="flex justify-center">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-4">
              Growth Tip
            </span>
          </div>
          <p className="text-sm text-primary font-medium mb-6">
            Invite a writer friend and you both get a free collaboration credit.
          </p>

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
