

# Viral Loop: Landing Page Updates

Four files to update with referral-focused messaging and a new network visual.

## 1. `DirectDiscoveryCard.tsx` — Replace A→B with Network Graphic + Growth Tip

Replace the entire SVG with a radial network animation inspired by the uploaded reference image:
- Central circle (the user) at center, `#f47458` fill with a soft glow
- 12 surrounding circles (collaborators) arranged in a radial pattern, lighter coral fill
- Animated lines connecting center to each outer dot, staggered with framer-motion
- All dots scale in, then lines draw from center outward

Add a "Growth Tip" badge below the graphic (before the heading):
```
<span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 text-primary text-xs font-medium mb-4">
  Growth Tip
</span>
```
Text beneath badge: "Invite a writer friend and you both get a free collaboration credit."

Keep the existing heading and body text.

## 2. `BottomCTASection.tsx` — New Pricing Copy

- Headline: "Grow together. Stay free."
- Subline 1: "Your first 3 collaborations are free. Want more? Unlock 1 extra collaboration for every friend who joins."
- Remove "No credit card. No 7-day trial limits." line
- Button text: "Start growing for free"

## 3. `HeroSection.tsx` — Update Micro-copy

Change the `<p>` below the CTA buttons from:
"No credit card. No time limits."
to:
"No credit card. Earn more free collabs by inviting friends."

## 4. `FeatureRoadmapSection.tsx` — Add Referral FAQ

Add a 7th entry to the `principles` array:
```
Q: "How do I get more collaboration credits?"
A: "Simple—invite your friends. When a writer you invite joins DraftKit, we give both of you a free collaboration credit. It's our way of saying thanks for helping the community grow."
```

## Files

| File | Change |
|---|---|
| `src/components/landing/DirectDiscoveryCard.tsx` | Replace A→B SVG with radial network graphic + growth tip badge |
| `src/components/landing/BottomCTASection.tsx` | Update headline, body, and button text |
| `src/components/landing/HeroSection.tsx` | Update micro-copy below CTA |
| `src/components/landing/FeatureRoadmapSection.tsx` | Add referral FAQ entry |

