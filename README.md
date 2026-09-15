# Daniel Xie — Portfolio

A personal portfolio covering hospitality, media, education, and modeling. Built with plain HTML, CSS, and JavaScript; no installation or build step is required.

## Website files

The complete website is in `dist/`:

- `index.html` — portfolio content, media, experience, education, and contact.
- `styles.css` — base layout and responsive rules.
- `luxury.css` — black, cream, and gold styling, branded experience sections, and motion treatments.
- `script.js` — navigation, scroll reveals, reading progress, and on-demand Instagram embeds.
- `effects.js` — the corn dog cursor follower, photo effects, border traces, and the persistent motion control.
- `loader.js` — a brief, dismissible film-reel preloader with a hard timeout.
- `assets/` — portfolio photography and organization logos supplied by Daniel.

Serve `dist/` at the root of a static website. Internal assets use root-relative URLs. For a local preview, run `python3 -m http.server 8000 --directory dist` and open `http://localhost:8000`.

## Content and media

Professional and education details, creative credits, photographs, logos, and project links were supplied or approved by Daniel. The hospitality showcase includes OC Lobster Pot, Bob’s Seafood & Grill, and Aventis Inn.

The featured Purdue campaign and five additional campus videos link to the exact Instagram posts Daniel supplied. Archive embeds load on opening their panel and unload when it closes. Direct source links remain available if Instagram restricts embedded playback.

Chased uses the supplied YouTube video. Glovebox and Hustle. are upcoming films, with brief teasers and no invented release dates.

## Accessibility

Navigation and expandable video panels support keyboard use. Images have descriptive alternative text or empty alternatives where adjacent labels already identify the logo. Motion respects system preferences and can be paused with the footer control. The layout adapts to mobile screens.

## Maintenance

Edit website content in `dist/index.html`. Keep organization logos as supplied, with their aspect ratios intact. Validate internal links, local assets, and JavaScript syntax after changes. Third-party players depend on their providers’ policies.

## Personal details and loading behavior

The selected-work card uses the approved Lazy Dog product photograph. Business website links remain limited to the three selected hospitality projects. The CBS segment uses the user-supplied YouTube video `bZfco5c4NwY`, starting at 90 seconds, with standard playback controls and direct YouTube/CBS source links.

The loader waits only for initial photography and fonts, clears as soon as they are ready, and has no artificial minimum duration. A 1.6-second controller deadline and an independent 2.2-second startup fail-safe prevent it from covering the site indefinitely. Visitors can enter immediately with the button, Tab, or Escape. It is omitted when system reduced motion or the site’s saved motion-off preference is enabled. No JavaScript means no loading overlay.

`assets/corndog-cursor.webp` is an original cursor illustration created using built-in imagegen. Its source was converted losslessly to WebP; every pixel and the transparent alpha were preserved. Prompt: “One miniature Korean corn dog cursor accent, warm golden panko crust, subtle ketchup and mustard zigzag, short wooden stick, upright with slight jaunty tilt; realistic tactile product cutout, clean silhouette, transparent alpha background; no face, eyes, lettering, logo, plate, hands, external cast shadow, or backdrop.” The generated asset is 929 × 1693 pixels, displayed as a small decorative follower over work cards. The normal pointer remains visible. Touch and reduced-motion modes omit the follower.

The reel loader and favicon adapt the MIT-licensed Phosphor film-reel icon: https://github.com/phosphor-icons/core/blob/main/assets/regular/film-reel.svg. Its license is included in `dist/licenses/phosphor-icons.txt`.
