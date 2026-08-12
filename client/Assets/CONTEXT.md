# CONTEXT.md — `client/Assets/`

## What this directory is

An **empty placeholder** directory at the client root. It currently contains no files and is not referenced by any code in `client/src/`.

## Notes & gotchas

- The directory is tracked by git (intentionally kept for historical or future use) but has no runtime effect.
- Do **not** put importable assets here — CRA does not bundle or transform `Assets/` at the project root. For assets the React code needs to `import`, place them in `src/` (or `public/` for static absolute-path references, like `public/Assets/loading.mp4`).
- This is a separate directory from `client/public/Assets/` and serves a different purpose. Don't confuse the two.
- No `AGENTS.md` here — this directory contains no subdirectories and no files.
