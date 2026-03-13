import { motion } from "framer-motion";
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

const barData = [
  { name: "Organic search", value: 35 },
  { name: "Cross-promos", value: 30 },
  { name: "Social", value: 20 },
  { name: "Word of mouth", value: 10 },
  { name: "Passive recs", value: 5 },
];

const areaData = [
  { subs: "0", active: 100 },
  { subs: "50", active: 92 },
  { subs: "100", active: 78 },
  { subs: "200", active: 55 },
  { subs: "300", active: 38 },
  { subs: "400", active: 30 },
  { subs: "500", active: 25 },
];

const donutData = [
  { name: "High-coordination collabs", value: 60 },
  { name: "Other channels", value: 40 },
];

const ORANGE = "hsl(var(--primary))";
const ORANGE_MUTED = "hsl(var(--primary) / 0.3)";

const cards = [
  {
    title: "The Discovery Gap",
    label: "The algorithm is not coming to save you.",
    subtitle: "Growth sources for writers under 1k subscribers",
  },
  {
    title: "The Loneliness Wall",
    label: "75% of writers quit before 500 subs.",
    subtitle: "Active writers vs. subscriber milestone",
  },
  {
    title: "The Inner Circle",
    label: "The top 1% grow through collaboration.",
    subtitle: "Elite growth attribution breakdown",
  },
];

export function RealityOfGrowthSection() {
  return (
    <section className="py-24 px-6">
      <div className="max-w-6xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">The reality of growth</h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Three data points every creator should see before writing another word alone.
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {/* Card 1 — Bar Chart */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0 }}
            className="glass-card p-6 border border-primary/20"
          >
            <h3 className="font-semibold text-foreground mb-1">{cards[0].title}</h3>
            <p className="text-xs text-muted-foreground mb-4">{cards[0].subtitle}</p>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barData} layout="vertical" margin={{ left: -10, right: 10, top: 0, bottom: 0 }}>
                   <XAxis type="number" hide />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} width={90} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    formatter={(value: number) => [`${value}%`, "Share"]}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {barData.map((entry, i) => (
                      <Cell key={i} fill={entry.name === "Passive recs" ? ORANGE : ORANGE_MUTED} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <p className="text-sm font-medium text-foreground mt-4 leading-snug">{cards[0].label}</p>
          </motion.div>

          {/* Card 2 — Area Chart */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.12 }}
            className="glass-card p-6 border border-primary/20"
          >
            <h3 className="font-semibold text-foreground mb-1">{cards[1].title}</h3>
            <p className="text-xs text-muted-foreground mb-4">{cards[1].subtitle}</p>
            <div className="h-48">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={areaData} margin={{ left: -20, right: 10, top: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="orangeGradient" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor={ORANGE} stopOpacity={0.4} />
                      <stop offset="100%" stopColor={ORANGE} stopOpacity={0.05} />
                    </linearGradient>
                  </defs>
                   <XAxis dataKey="subs" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                   <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    formatter={(value: number) => [`${value}%`, "Still active"]}
                  />
                  <Area type="monotone" dataKey="active" stroke={ORANGE} fill="url(#orangeGradient)" strokeWidth={3} dot={false} activeDot={{ r: 6, fill: ORANGE, stroke: "white", strokeWidth: 2 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <p className="text-sm font-medium text-foreground mt-4 leading-snug">{cards[1].label}</p>
          </motion.div>

          {/* Card 3 — Donut Chart */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.5, delay: 0.24 }}
            className="glass-card p-6 border border-primary/20"
          >
            <h3 className="font-semibold text-foreground mb-1">{cards[2].title}</h3>
            <p className="text-xs text-muted-foreground mb-4">{cards[2].subtitle}</p>
            <div className="h-48 flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donutData}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                    strokeWidth={0}
                  >
                    <Cell fill={ORANGE} />
                    <Cell fill={ORANGE_MUTED} />
                  </Pie>
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8, fontSize: 12 }}
                    formatter={(value: number) => [`${value}%`]}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex items-center gap-4 text-xs text-muted-foreground mt-2">
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-primary" />
                Collabs (60%)
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-primary/30" />
                Other (40%)
              </span>
            </div>
            <p className="text-sm font-medium text-foreground mt-3 leading-snug">{cards[2].label}</p>
          </motion.div>
        </div>
      </div>
    </section>
  );
}
