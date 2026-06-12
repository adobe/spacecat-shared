# Agent Notes

## Workspace Setup

If dependency resolution or generated project files are stale, regenerate the local project files and install workspace dependencies from the repo root:

```sh
./spacecat project-files --install
```

Use this before falling back to manual `pnpm install` or debugging missing workspace dependencies.
