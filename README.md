# MarTech Discovery Platform

Static-first bilingual MarTech discovery platform with Cloudflare Pages Functions, D1-backed admin APIs, member accounts, vendor profiles, and SEO assets.

## Build

Requires Node.js and Wrangler 4.

```sh
node build.mjs
```

This generates the production site in `dist/`. Cloudflare Pages Functions are kept in `functions/` and use the D1 binding declared in `wrangler.jsonc`.

## Deploy to Cloudflare Pages

```sh
node build.mjs
wrangler pages deploy dist --project-name=martech-discovery-platform --branch=main
```

## Project layout

- `build.mjs` — generates localized pages, directory routes, sitemap, and AI discovery files.
- `functions/` — Cloudflare Pages Functions and API routes.
- `migrations/` — D1 schema migrations.
- `lang/` — locale dictionaries.
- `assets/` — platform artwork, fonts, and vendor logo assets.
- `data-ontology.json`, `vendor-categories.json`, `tool-descriptions.json` — platform catalog metadata.

## Local data and secrets

Do not commit `.dev.vars`, `.env` files, Wrangler state, production database exports, or credentials. Local secret values belong in Wrangler's secret store or ignored local environment files.
