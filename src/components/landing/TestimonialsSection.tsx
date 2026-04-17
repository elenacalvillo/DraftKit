import { motion } from "framer-motion";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Quote, DoorOpen, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import stefImage from "@/assets/profiles/stef.jpg";
import karoImage from "@/assets/profiles/karo.jpg";
import dheerajImage from "@/assets/profiles/dheeraj.jpg";

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
    quote: "The content-matched ideas based on both our profiles felt like a very thoughtful and differentiating touch. The sign-up experience was smooth, and being able to create my own collaboration page right away felt really nice and empowering.",
    highlight: "thoughtful and differentiating",
  },
  {
    name: "Karo",
    role: "PM",
    image: karoImage,
    initials: "KA",
    quote: "Beautiful build by a fellow PM. I love that my calendar is under my rules and people can only book in the windows I chose.",
    highlight: "my calendar is under my rules",
  },
  {
    name: "Dheeraj",
    role: "Newsletter Creator",
    image: dheerajImage,
    initials: "DH",
    quote: "That's a really fantastic tool that you build and makes it super convenient. I vibe coded a single page app more like brute force for something similar but I don't think I need it anymore now that you have launched this :)",
    highlight: "super convenient",
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
            Trusted by creators who ship
          </h2>
          <p className="text-muted-foreground text-lg max-w-xl mx-auto">
            From newsletter writers to PMs — here's what they found when they stopped scheduling and started collaborating
          </p>
        </motion.div>

        <div className="grid md:grid-cols-3 gap-6 mb-6">
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
                    <AvatarImage
                      src={testimonial.image}
                      alt={testimonial.name}
                      className="object-cover"
                      loading="lazy"
                      decoding="async"
                    />
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

        {/* Guest Principle Banner */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5, delay: 0.3 }}
          className="glass-card p-6 md:p-8 border-l-4 border-primary flex flex-col md:flex-row items-start md:items-center gap-6"
        >
          <div className="w-12 h-12 rounded-xl gradient-primary flex items-center justify-center text-primary-foreground shrink-0">
            <DoorOpen className="w-6 h-6" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-foreground text-lg mb-1">"Your guest is never the subscriber."</p>
            <p className="text-muted-foreground text-sm leading-relaxed">
              DraftKit runs on the Meeting Room model. You own the engine (Pro), so your collaborators join the ride — always free. No credit cards, no cover charges, no paywalls for the people who are there to help you write.
            </p>
          </div>
          <Link
            to="/demo"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline shrink-0"
          >
            Learn more <ArrowRight className="w-4 h-4" />
          </Link>
        </motion.div>
      </div>
    </section>
  );
}
