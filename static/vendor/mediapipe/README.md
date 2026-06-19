# Vendored MediaPipe Tasks-Vision (pose landmarker)

Markerless pose estimation for the `/form` motion-capture analyzer. Vendored so
the feature runs fully client-side and offline (PWA) with no CDN dependency —
video never leaves the device.

## Contents / provenance

| File | Source | Version |
|------|--------|---------|
| `vision_bundle.mjs` | `@mediapipe/tasks-vision` (jsDelivr) | 0.10.18 |
| `wasm/vision_wasm_internal.{js,wasm}` | same package, `/wasm/` | 0.10.18 |
| `wasm/vision_wasm_nosimd_internal.{js,wasm}` | same package, `/wasm/` | 0.10.18 |
| `pose_landmarker_lite.task` | Google MediaPipe model storage | `float16/latest` (lite) |

Model URL:
`https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/latest/pose_landmarker_lite.task`

The **lite** model (~5.8 MB) is chosen over full/heavy to keep the offline cache
small and inference fast on phones; full is more accurate if accuracy ever beats
size. The `nosimd` WASM is the fallback the fileset resolver picks when the
browser lacks SIMD.

## To update

Re-download the four `tasks-vision` files at the new pinned version and the
`.task` model, drop them in place, bump the version in this table and the
`MP_*` constants in `static/apollo-form.js`, and bump the cache name in
`static/sw.js` so clients re-fetch.
