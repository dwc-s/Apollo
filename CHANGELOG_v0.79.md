v0.79 — The shot played back, a shadow to carry the lines

v0.78 measured your form and threw the video away. This release lets you watch a
saved shot again — but since the footage was never kept, the figure you see is a
**silhouette rebuilt from the pose points alone**, with the form's angle lines
drawn over it. No video is stored or recovered; the replay is pure geometry.

- **Replay a saved shot.** Each entry in "Recent analyses" that has pose data
  now carries a **▶ Replay** button. It animates the shot on the form stage —
  play / pause and a scrub slider — reconstructing a body silhouette (torso,
  limbs, head) frame by frame from the stored skeleton.

- **Angle lines on the silhouette.** Over the moving figure, the checkpoint
  lines are drawn and coloured by the saved grade — the draw forearm and arrow
  line, the shoulder line, bow shoulder and bow arm, the spine, the head, the
  anchor — green for pass, amber for warn, red for fault. The full-draw frame is
  marked, and the readings are listed alongside.

- **Anonymous, owner-only.** Saving now also stores a compact, downsampled,
  rounded pose sequence (just points — never an image). It lives in a new
  `frames_json` column, is dropped if it would be implausibly large, and is
  purged with the account like everything else. The fetch endpoint
  (`/form/capture/<id>`) is scoped to the owner, so a saved shot can't be read
  across accounts.

Under the floor: an idempotent migration adds `frames_json` to existing
databases; the history list tests for replay data in SQL rather than hauling the
pose blob for every row; and a capture and a replay can no longer fight over the
same canvas (starting one stops the other). The pure replay
build/reconstruct helpers are unit-tested in Node, and the save → fetch → replay
round-trip, owner-scoping and the size guard are covered end-to-end. 29 Python
tests, 56 form-math assertions, and the /form e2e all pass; the silhouette and
coloured angle lines were confirmed rendering in a real browser.
