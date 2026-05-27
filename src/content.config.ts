// Astro Content Collections config for the Solca blog.
// One collection, two categories — kept flat to make migration from _docs/*.md trivial.
import { defineCollection, z } from 'astro:content';
import { glob } from 'astro/loaders';

const blog = defineCollection({
  loader: glob({ pattern: '**/*.md', base: './src/content/blog' }),
  schema: z.object({
    title: z.string().min(8).max(120),
    // Short pitch used as meta description + OG description + card teaser.
    description: z.string().min(40).max(180),
    // Public publication date (ISO yyyy-mm-dd).
    pubDate: z.coerce.date(),
    // Optional revision date — surfaced when the post has been edited after publish.
    updatedDate: z.coerce.date().optional(),
    // Hero image path relative to /public (or absolute URL).
    heroImage: z.string(),
    // Two categories per editorial decision (25 may 2026):
    //   carreras-pharma  → pharma careers, also cross-posted to LinkedIn
    //   academia         → academic angle (PhD/papers/posgrados) framed for pharma roles
    category: z.enum(['carreras-pharma', 'academia']),
    // Free-form tags for cross-linking and on-page taxonomy.
    tags: z.array(z.string()).default([]),
    // Series tag (e.g., "lo-que-dicen-las-vacantes", "newsletter") for sectioned indexes.
    series: z.string().optional(),
    // Optional sub-numbering within a series (1, 2, 3…).
    seriesIndex: z.number().int().positive().optional(),
    // Author override (defaults applied in templates).
    author: z.string().default('Oscar Solís Castro'),
    // If true, the post still renders by direct URL but does not appear in the index.
    draft: z.boolean().default(false),
    // Canonical override. If omitted, defaults to the post's own URL on solcaciencia.com.
    canonical: z.string().url().optional(),
    // Estimated reading time in minutes — overridable; templates compute fallback if missing.
    readingMinutes: z.number().int().positive().optional(),
  }),
});

export const collections = { blog };
