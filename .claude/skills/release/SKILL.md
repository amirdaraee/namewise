---
name: release
description: Build, test, version-bump, and push tags to trigger the npm publish workflow for namewise. Usage - /release [patch|minor|major], defaults to patch.
disable-model-invocation: true
---

# Release namewise

Releases are driven by `v*` tags: pushing the tag triggers `.github/workflows/release.yml` (test -> build -> npm publish -> GitHub release).

Publishing authenticates via OIDC against the trusted publisher configured on npm for this repo + `release.yml`. There is no NPM_TOKEN: the job needs `id-token: write`, and published versions carry provenance attestation.

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

1. Push commit and tag together:
   ```bash
   git push --follow-tags
   ```
2. Confirm the release workflow started and succeeded:
   ```bash
   gh run watch $(gh run list --workflow=release.yml --limit 1 --json databaseId -q '.[0].databaseId')
   ```
3. Verify the publish. The registry takes a minute or two to serve a new
   version, so a 404 right after a successful run means "still processing",
   not "failed":
   ```bash
   npm view @amirdaraee/namewise version
   ```

`src/index.ts` reads the version from `package.json` at runtime, so there is no
version string to keep in sync and nothing to amend after `npm version`.

## If the workflow needs a fix mid-release

Actions runs the workflow file **from the ref that triggered it**, so fixing
`release.yml` on `main` does nothing for an existing tag — `gh run rerun` will
replay the old file. The tag has to move:

```bash
git push origin :refs/tags/v<X.Y.Z>   # delete remote tag
git tag -d v<X.Y.Z> && git tag v<X.Y.Z>
git push origin v<X.Y.Z>              # retriggers the release
```

Only do this while the version is genuinely unconsumed - not on npm and no
GitHub release for it. Once either exists, ship a new patch version instead.
