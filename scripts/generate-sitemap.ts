// Runs before `vite dev` and `vite build` (predev/prebuild hooks); writes public/sitemap.xml.

import { writeFileSync } from "fs";
import { resolve } from "path";

const BASE_URL = "https://draftkit.app";

// Supabase anon credentials (public publishable key, safe to embed).
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY =
  process.env.VITE_SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_PUBLISHABLE_KEY;

interface SitemapEntry {
  path: string;
  lastmod?: string;
  changefreq?: "always" | "hourly" | "daily" | "weekly" | "monthly" | "yearly" | "never";
  priority?: string;
}

// Static public, indexable routes. Protected/dashboard/private routes omitted.
const staticEntries: SitemapEntry[] = [
  { path: "/", changefreq: "weekly", priority: "1.0" },
  { path: "/demo", changefreq: "monthly", priority: "0.8" },
  { path: "/signup", changefreq: "monthly", priority: "0.7" },
  { path: "/transparency", changefreq: "monthly", priority: "0.5" },
  { path: "/terms", changefreq: "yearly", priority: "0.4" },
  { path: "/privacy", changefreq: "yearly", priority: "0.4" },
  { path: "/refund-policy", changefreq: "yearly", priority: "0.4" },
  { path: "/login", changefreq: "yearly", priority: "0.3" },
  { path: "/forgot-password", changefreq: "yearly", priority: "0.2" },
  { path: "/reset-password", changefreq: "yearly", priority: "0.2" },
];

// Fetch every public creator profile username for the dynamic /:username route.
// Source mirrors the route's loader: the public_creator_profiles view.
async function fetchProfileEntries(): Promise<SitemapEntry[]> {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.warn("[sitemap] Supabase env vars missing; skipping dynamic profile entries.");
    return [];
  }

  const usernames: string[] = [];
  let from = 0;
  const pageSize = 1000;

  // Paginate through all public profiles.
  for (;;) {
    const url = `${SUPABASE_URL}/rest/v1/public_creator_profiles?select=username&username=not.is.null&order=username.asc&limit=${pageSize}&offset=${from}`;
    const res = await fetch(url, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      },
    });
    if (!res.ok) {
      console.warn(`[sitemap] public_creator_profiles fetch failed: ${res.status}`);
      return [];
    }
    const rows = (await res.json()) as { username: string | null }[];
    if (!rows.length) break;
    for (const r of rows) {
      if (r.username) usernames.push(r.username);
    }
    if (rows.length < pageSize) break;
    from += pageSize;
  }

  return usernames.map((u) => ({
    path: `/${u}`,
    changefreq: "weekly" as const,
    priority: "0.6",
  }));
}

function generateSitemap(entries: SitemapEntry[]): string {
  const urls = entries.map((e) =>
    [
      `  <url>`,
      `    <loc>${BASE_URL}${e.path}</loc>`,
      e.lastmod ? `    <lastmod>${e.lastmod}</lastmod>` : null,
      e.changefreq ? `    <changefreq>${e.changefreq}</changefreq>` : null,
      e.priority ? `    <priority>${e.priority}</priority>` : null,
      `  </url>`,
    ]
      .filter(Boolean)
      .join("\n"),
  );

  return [
    `<?xml version="1.0" encoding="UTF-8"?>`,
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">`,
    ...urls,
    `</urlset>`,
  ].join("\n");
}

async function main() {
  const profileEntries = await fetchProfileEntries();
  const entries = [...staticEntries, ...profileEntries];
  const xml = generateSitemap(entries);
  writeFileSync(resolve("public/sitemap.xml"), xml);
  console.log(
    `sitemap.xml written (${entries.length} entries: ${staticEntries.length} static + ${profileEntries.length} profiles)`,
  );
}

main().catch((err) => {
  console.error("[sitemap] generation failed:", err);
  // Still emit a static-only sitemap so the build never breaks.
  const xml = generateSitemap(staticEntries);
  writeFileSync(resolve("public/sitemap.xml"), xml);
  console.warn(`[sitemap] fallback sitemap.xml written (${staticEntries.length} static entries)`);
});
