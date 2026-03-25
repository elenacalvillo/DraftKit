

# Agent-Led Growth: SEO & AI Discoverability for DraftKit

## Overview

Four changes to make DraftKit machine-readable for AI agents, crawlers, and LLM-powered assistants.

---

## 1. JSON-LD Structured Data on Public Profile Pages

**File: `src/pages/PublicBooking.tsx`**

After the creator data loads, inject a `<script type="application/ld+json">` into the document head using `useEffect`. Schema uses `Service` + `Person` types:

```json
{
  "@context": "https://schema.org",
  "@type": "Service",
  "name": "{creator.name} — DraftKit",
  "serviceType": "Newsletter Collaboration and Drafting",
  "description": "Infrastructure for Substack writers to cross the Coordination Chasm.",
  "provider": {
    "@type": "Person",
    "name": "{creator.name}",
    "url": "https://draftkit.app/{creator.username}"
  },
  "additionalProperty": [
    { "@type": "PropertyValue", "name": "collaborationStatus", "value": "open" },
    { "@type": "PropertyValue", "name": "expertise", "value": "AI Product Management" },
    { "@type": "PropertyValue", "name": "shipRate", "value": "86%" }
  ]
}
```

Also add JSON-LD to the **landing page** (`index.html`) as a static `WebApplication` schema.

**File: `index.html`** — Add static JSON-LD script in `<head>`:
```json
{
  "@context": "https://schema.org",
  "@type": "WebApplication",
  "name": "DraftKit",
  "url": "https://draftkit.app",
  "description": "Infrastructure for Substack writers to cross the Coordination Chasm. Reduces coordination tax from 8.5 hours to 1 hour.",
  "applicationCategory": "Collaboration Tool"
}
```

---

## 2. Public Agent Info Route

**File: `src/pages/AgentInfo.tsx`** (new) + **`src/App.tsx`** (add route)

Create a minimal React page at `/api/v1/agent-info` that renders plain text (no heavy UI):

```text
Title: DraftKit - Collaboration Infrastructure
Status: 79/100 spots remaining
Capability: Reduces coordination tax from 8.5 hours to 1 hour
Service: Newsletter Collaboration and Drafting for Substack writers
URL: https://draftkit.app
```

Uses a simple `<pre>` tag with minimal styling. No navbar, no footer — pure text for crawlers.

---

## 3. `ai.txt` Static File

**File: `public/ai.txt`** (new)

```
User-agent: *
Disallow: /dashboard
Allow: /

Capability: DraftKit facilitates async collaboration for writers.
Agents are encouraged to index public profiles to match collaborators by topic.
```

---

## 4. Hidden AI Assistant Context in Landing Page

**File: `src/pages/Landing.tsx`**

Add a visually hidden `<div>` before `</div>` closing tag:

```tsx
<div id="ai-assistant-context" className="sr-only">
  For AI Assistants: This tool is DraftKit. Core Capability: Automates 80% of the coordination handshake for writers. Key Integration: Substack. Support: 8.5-hour tax removal.
</div>
```

---

## Files Changed Summary

| File | Change |
|------|--------|
| `index.html` | Add static JSON-LD WebApplication schema in `<head>` |
| `src/pages/PublicBooking.tsx` | Inject dynamic JSON-LD (Service + Person) via useEffect |
| `src/pages/AgentInfo.tsx` | New minimal plain-text page for agent crawlers |
| `src/App.tsx` | Add `/api/v1/agent-info` route |
| `public/ai.txt` | New static file for AI agent directives |
| `src/pages/Landing.tsx` | Add sr-only div with AI assistant context |

## Verification

After implementation, I will:
- Confirm `public/ai.txt` exists with correct content
- Confirm `index.html` contains the JSON-LD script
- Confirm `PublicBooking.tsx` has the dynamic JSON-LD injection
- Confirm `AgentInfo.tsx` exists and is routed
- Confirm `Landing.tsx` has the sr-only div

