---
name: release
description: Build, test, version-bump, and push tags to trigger the npm publish workflow for namewise. Usage - /release [patch|minor|major], defaults to patch.
disable-model-invocation: true
---

# Release namewise

Releases are driven by `v*` tags: pushing the tag triggers `.github/workflows/release.yml` (test -> build -> npm publish -> GitHub release).

## Pre-flight checks (abort if any fail)

1. On `main` with a clean working tree:
   ```bash
   git status --porcelain   # must be empty
   git branch --show-current # must be main
   git pull --ff-only
   ```
2. Tests and build pass locally: `npm run test:run && npm run build`

## Release

Bump level comes from the argument (default `patch`):

```bash
npm run release          # patch
npm run release:minor    # minor
npm run release:major    # major
```

This runs build + tests again, then `npm version <level>` which commits and creates the `vX.Y.Z` tag.

## Post-bump

1. Check the hardcoded version string in `src/index.ts` - it can lag behind `package.json`. If it does, update it, amend it into the version commit, and move the tag:
   ```bash
   git add src/index.ts && git commit --amend --no-edit
   git tag -f v<X.Y.Z>
   ```
2. Push commit and tag together:
   ```bash
   git push --follow-tags
   ```
3. Confirm the release workflow started and succeeded:
   ```bash
   gh run watch $(gh run list --workflow=release.yml --limit 1 --json databaseId -q '.[0].databaseId')
   ```
4. Verify the publish: `npm view @amirdaraee/namewise version`
