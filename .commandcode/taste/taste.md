# Taste

## Workflow & tooling
- Runs the app from compiled output (`dist/`, `dist-electron/`), not a dev server — expects source edits in `src/`/`electron/` to be rebuilt (`tsc -b && vite build`) so the running app reflects the latest changes; do not hand-edit built bundles. Confidence: 0.7
- Wants the project kept clean of duplicate/stale artifacts — old installers, outdated build outputs, compiled duplicates of config files, and leftover generated files should be deleted, keeping only current/needed versions (e.g., only the current installer, only current build output). Confidence: 0.8

## Communication
- Gives terse, minimal instructions (e.g., "make the latest edits in the app. in the dist folder"; "add website adding option here. like the social medias") and expects the assistant to infer the full task from context. Confidence: 0.7

## Product & domain
- Wants the time tracker scoped per client — timing must be recorded against the client it belongs to and never mixed/leaked with other clients' sessions (e.g., a paused session from Client A must not take over Client B's tracker screen). Confidence: 0.8
- Prefers new features to follow existing UI patterns — e.g., add "Website" as a platform option alongside the social media accounts in the same modal/selector, not as a separate flow. Confidence: 0.6
