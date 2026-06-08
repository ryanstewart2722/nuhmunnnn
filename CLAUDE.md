# Naman Nanda Portfolio — Claude Working Instructions

## Before starting ANY task

Always lead with a plan:
1. **What I'm going to do** — specific steps
2. **Likelihood of success** — honest assessment per step
3. **Alternatives** — flag if there's a simpler/safer approach I haven't considered
4. **Questions** — ask anything that would change the approach before touching code

Do this even for small changes. Skip it only if the user explicitly says to just go ahead.

## Always include a preview link

After every code change, include the relevant localhost link(s):
- http://localhost:56218/index.html
- http://localhost:56218/flaus-project.html
- http://localhost:56218/pax-project.html
- http://localhost:56218/about.html

## Site architecture

Vanilla HTML/CSS/JS. No framework. No build step. Node.js dev server on port 8090 (or 56218 in preview).

### Files
- `index.html` — portfolio grid / canvas view
- `flaus-project.html` — Flaus project page
- `pax-project.html` — Pax project page
- `about.html` — about page
- `gallery.js` — shared lightbox/gallery (IIFE), loaded on project pages
- `shared layout pattern` — no shared CSS file; each page has inline `<style>`

### Frame — all 4 gray strips, always fixed
Every page must have:
```html
<div id="bl"></div>
<div id="br"></div>
```
And in CSS:
```css
#bl { position: fixed; top:0; left:0; bottom:0; width:15px; background:#D9D9D9; z-index:950; pointer-events:none; }
#br { position: fixed; top:0; right:0; bottom:0; width:15px; background:#D9D9D9; z-index:950; pointer-events:none; }
#nav    { position: fixed; top:0; left:0; right:0; height:28px; background:#D9D9D9; z-index:200; }
#footer { position: fixed; bottom:0; left:0; right:0; height:28px; background:#D9D9D9; z-index:200; }
```
These must be visible on ALL screen sizes (desktop + mobile). Do NOT hide them in media queries.

### Gallery (gallery.js)
- Shared across all project pages
- Each page defines `window.GALLERY_IMAGES = [...]` before loading gallery.js
- Gallery overlay: `position:fixed; top:28px; bottom:28px; left:15px; right:15px; z-index:900`
- **IMPORTANT**: Always quote URLs in CSS background-image: `url("` + src + `")` — unquoted URLs break on filenames with spaces

### New project pages
When creating a new project page:
1. Copy `flaus-project.html` or `pax-project.html` as a template
2. Include `<div id="bl"></div>` and `<div id="br"></div>` in the body
3. Use the fixed frame CSS above
4. Define `window.GALLERY_IMAGES` before `<script src="./gallery.js"></script>`
5. Update `index.html` project list to include the new page URL
6. Name the file `[project-name]-project.html`
