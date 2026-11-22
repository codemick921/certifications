# Credential portfolio

A static portfolio for certifications. No framework, no build step, no dependencies.
Cloudflare Pages serves the repository root directly.

---

## Run it locally

```bash
npm run dev
# → http://127.0.0.1:4173
```

Opening `index.html` by double-clicking will not work: the page fetches JSON, and
browsers block that over `file://`.

## Add a certification

**Option A, the prompt:**

```bash
npm run add-cert
```

It asks for issuer, title, status, date, category, verification URL and skills, then
writes the entry to `data/certs.json`.

**Option B, edit `data/certs.json` by hand.** Copy this shape and edit it:

```json
{
  "id": "issuer-certificate-name",
  "title": "Certificate name",
  "issuer": "Issuer",
  "category": "Analytics",
  "date": "2026-11",
  "status": "completed",
  "credentialId": "ABC-123",
  "verifyUrl": "https://issuer.example.com/verify/abc-123",
  "embed": { "type": "none" },
  "skills": ["GA4", "Measurement"]
}
```

| Field | Required | Notes |
|---|---|---|
| `id` | yes | Any unique slug. Used for the shareable link `#cert-<id>`. |
| `title` | yes | Shown on the card and in the dialog. |
| `issuer` | yes | Drives the filter chips. |
| `date` | no | `YYYY-MM` or `YYYY-MM-DD`. Blank sorts last. |
| `status` | yes | `completed`, `in-progress` or `planned`. |
| `credentialId` | no | Shown in the dialog header. |
| `verifyUrl` | no | Adds a "Verifiable" mark and a Verify button. |
| `badge` | no | Square image for the card, e.g. `/certs/badge.png`. |
| `embed` | no | See below. Defaults to `none`. |
| `skills` | no | Array of short labels. |
| `note` | no | Free text. Shows on the in-progress list. |
| `placeholder` | no | Set `true` to show the "sample" ribbon. |

### Embedding the certificate itself

Put the file in `certs/` and reference it from the site root:

```json
"embed": { "type": "pdf", "src": "/certs/google-analytics-4.pdf" }
"embed": { "type": "image", "src": "/certs/hubspot-inbound.png" }
"embed": { "type": "iframe", "src": "https://www.credly.com/embedded_badge/xxxxx" }
```

Use `iframe` for Credly, Badgr or any issuer that gives you an embed snippet.
Copy only the `src` URL from their snippet. `frame-src https:` in `_headers`
already allows it.

### Removing the sample entries

```bash
npm run add-cert -- --remove-placeholders
```

There are three entries marked `"placeholder": true`. While any remain, the site
shows a banner at the top so you can't ship them by accident.

## Files that matter

| Path | What it is |
|---|---|
| `data/certs.json` | Every credential. The only file you edit regularly. |
| `data/profile.json` | Name, headline, links, about paragraphs, contact line. |
| `certs/` | Certificate PDFs, PNGs and badge images. |
| `index.html` | Page structure. |
| `assets/css/styles.css` | All styling, including print styles. |
| `assets/js/main.js` | Rendering, filtering, modal, schema markup. |
| `_headers` | Security headers and cache policy for Cloudflare Pages. |

## Deploy to Cloudflare Pages

The site is plain static files, so the Pages build is a no-op.

1. Push this folder to a GitHub repository.
2. Cloudflare dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.
3. Pick the repository.
4. Build settings:
   - **Framework preset:** None
   - **Build command:** leave empty
   - **Build output directory:** `/`
5. **Save and Deploy.** The first build takes about 30 seconds.

Every later `git push` to the production branch redeploys automatically.

### Custom domain

Pages project → **Custom domains** → **Set up a domain**. If the domain's DNS is
already on Cloudflare, it is one click. Otherwise add the `CNAME` record Pages
gives you.

## Design notes

- Light editorial: warm paper `#FBFAF6`, near-black ink, one accent green `#1F4535`.
- Serif headings (Newsreader), sans body (Inter), both from Google Fonts with a
  system fallback so text renders before the webfont lands.
- Hairline borders instead of cards with shadows. 1px grid gaps.
- Keyboard: every card is a button, the dialog traps focus, Escape closes it.
- `prefers-reduced-motion` respected. `prefers-color-scheme` is not implemented,
  because the design is intentionally light-only.
- Printing gives a clean two-column credential list for a CV attachment.

## Adding a second page later

Copy `index.html`, rename it, and Cloudflare Pages serves it at that path without
configuration. Shared header, footer and styles carry over unchanged.
