v0.66 — Titles that fit the iPad

Page titles were getting clipped on iPads running Chrome — but not on iPhone
Chrome, and not on the desktop. The cause was a gap in the responsive
breakpoints: the mobile rules that let a title wrap and scale only kick in
below 768px, and iPads report portrait viewport widths of roughly 810–1024px.
That landed them on the desktop title rule — a locked 96px with
`white-space: nowrap; overflow: hidden` — so anything longer than the column
ran off the edge and was simply cut off. This release closes that gap.

- **Standard titles scale and wrap in the tablet range.** A new
  `769px–1024px` media query lets `.title` shrink with the viewport
  (`clamp(40px, 9vw, 96px)`) and wrap instead of clip, exactly as it already
  does on phones. "Previous sessions", "Tournament setup", "Zones — …" and the
  rest now stay fully legible on an iPad. Phones (≤768px) and real desktops
  (>1024px) are untouched.

- **The splash "Apollo" wordmark fits the content column.** The splash title
  has no width cap on desktop, and at tablet widths the fixed side-nav is still
  shown — so the usable content column is only `viewport − 240px` wide. Sizing
  the wordmark against the full viewport still overran it; it's now sized
  against the real content width
  (`clamp(60px, calc((100vw - 240px) / 5.2), 152px)`) so it never spills past
  the right edge.

CSS-only change. No schema changes, no new dependencies, and no service-worker
version bump needed — style.css is served stale-while-revalidate, so the fix
lands on the next visit.
