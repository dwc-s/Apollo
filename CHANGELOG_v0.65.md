v0.65 — Vector target faces and crisp replays

The bundled target face and the session-history thumbnails were both still
raster images, so they blurred on Retina screens and looked soft no matter how
much the canvas was supersampled. This release makes the whole target-face
pipeline vector: the default target is now a true WA 40cm 10-ring face drawn
from the canonical ring spec, and every shot-replay thumbnail is rendered as
inline SVG that stays razor-sharp at any size or pixel density. Switching the
default to a vector face surfaced a couple of latent issues on the live session
page, which are fixed here too.

- **New default target: a vector WA 40cm 10-ring face.** New accounts get a
  WA-style 40cm face (the WA 122cm 10-ring geometry scaled to a 40cm edge),
  drawn client-side as crisp colored rings instead of a JPEG. The scoring zones
  come straight from the canonical face spec, so the rings you see and the
  points you score agree exactly. Existing users are migrated on their next
  login: the old "40cm NASP target" is archived (hidden and de-defaulted, but
  the row and all of its shot history are kept intact) and the WA face becomes
  the active default. Default-target selection is now deterministic, so the new
  face is reliably preselected even though the seeded tournament faces also
  carry the default flag.

- **Shot-replay thumbnails are now SVG.** The replays under Previous sessions
  and in Analyze reports are rendered as resolution-independent SVG. For any
  target with a canonical face (the new default and all tournament faces) the
  rings are drawn as vector circles — perfectly crisp at every zoom level —
  with the shot markers, sequence numbers, miss markers and crosshair all
  vector too. Uploaded raster targets fall back to an embedded image with
  vector markers on top. The round thumbnails stay square at any width without
  relying on newer CSS, so they render correctly on older iOS as well.

- **Fixed: shots and the aim dot vanishing on the session page.** With the new
  vector face, the opaque face overlay could paint over the past-shot markers
  and the active aim dot, so recorded shots didn't show on iOS and the group
  history didn't show on desktop. The overlay layering is now explicit and
  order-independent: the face always sits beneath the crosshair, past shots and
  the active marker.

- **Bow and arrow no longer reset mid-session.** Reloading the session page
  partway through a session (a Recall-arrow redirect, a PWA refresh, or a
  service-worker re-fetch) used to snap the bow and arrow dropdowns back to
  their first option, even though shots were still recorded against the right
  arrow. The page now restores the bow and arrow from the latest shot in the
  session.

- **Accuracy & precision trends recolored.** On the combined trends chart,
  precision traces are now green (shades of #667867) and accuracy traces blue,
  with each granularity — per session, per quiver, all-time — getting its own
  distinct shade so overlapping traces of the same metric are easy to tell
  apart.

Existing users are migrated automatically on next login; no manual steps and no
data loss (the old target is archived, never deleted). No schema changes.
