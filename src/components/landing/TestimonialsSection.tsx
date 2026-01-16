import { motion } from "framer-motion";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Quote } from "lucide-react";
import stefImage from "@/assets/profiles/stef.jpg";

interface Testimonial {
  name: string;
  role: string;
  image?: string;
  initials: string;
  quote: string;
  highlight?: string;
}

const testimonials: Testimonial[] = [
  {
    name: "Stefania",
    role: "Newsletter Creator",
    image: stefImage,
    initials: "ST",
    quote: "The AI-generated ideas based on both our profiles felt like a very thoughtful and differentiating touch. The sign-up experience was smooth, and being able to create my own collaboration page right away felt really nice and empowering.",
    highlight: "thoughtful and differentiating",
  },
  {
    name: "Coming Soon",
    role: "Your feedback here",
    initials: "YF",
    quote: "We'd love to hear about your experience using CollabStack. Share your story and help others discover the power of meaningful collaborations.",
  },
  {
    name: "Coming Soon",
    role: "Your feedback here",
    initials: "YF",
    quote: "Join our growing community of newsletter creators who are building authentic connections and creating impactful collaborations together.",
  },
];

export function TestimonialsSection() {
  return (
    <section className="py-24 px-6">
      <div className="max-w-5xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center mb-16"
        >
          <h2 className="text-3xl md:text-4xl font-bold mb-4">
            What Creators Are Saying
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            Hear from newsletter creators who are building meaningful connections
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6">
          {testimonials.map((testimonial, index) => (
            <motion.div
              key={testimonial.name + index}
              initial={{ opacity: 0, y: 30 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ duration: 0.5, delay: index * 0.15 }}
              className={`relative p-6 rounded-2xl bg-card border border-border/50 shadow-sm hover:shadow-md transition-shadow ${
                index === 0 ? "md:col-span-1 ring-2 ring-primary/20" : ""
              }`}
            >
              <Quote className="absolute top-4 right-4 w-8 h-8 text-primary/20" />
              
              <div className="flex items-center gap-3 mb-4">
                <Avatar className="w-12 h-12 border-2 border-primary/20">
                  {testimonial.image ? (
                    <AvatarImage src={testimonial.image} alt={testimonial.name} className="object-cover" />
                  ) : null}
                  <AvatarFallback className="text-sm font-medium bg-muted">
                    {testimonial.initials}
                  </AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-semibold text-foreground">{testimonial.name}</p>
                  <p className="text-sm text-muted-foreground">{testimonial.role}</p>
                </div>
              </div>

              <blockquote className="text-muted-foreground leading-relaxed">
                {testimonial.highlight ? (
                  <>
                    {testimonial.quote.split(testimonial.highlight)[0]}
                    <span className="text-primary font-medium">{testimonial.highlight}</span>
                    {testimonial.quote.split(testimonial.highlight)[1]}
                  </>
                ) : (
                  `"${testimonial.quote}"`
                )}
              </blockquote>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}
