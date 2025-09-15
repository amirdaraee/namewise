# Release Process Documentation

This document explains how to release a new version of the Namewise CLI tool.

## Quick Release Commands

Based on your `package.json` scripts, you can use these commands for automated releases:

```bash
npm run release        # Patch version (1.0.0 → 1.0.1)
npm run release:minor  # Minor version (1.0.0 → 1.1.0)
npm run release:major  # Major version (1.0.0 → 2.0.0)
```

These commands will:
1. Run tests and build
2. Bump the version in `package.json`
3. Trigger the auto-release workflow

## Manual Release Process

If you prefer to do it manually:

### 1. Prepare the Release

```bash
# Ensure you're on main branch with latest changes
git checkout main
git pull origin main

# Run tests and build to ensure everything works
npm run test:run
npm run build
```

### 2. Update Version

Choose the appropriate version bump:
- **Patch** (bug fixes): `1.0.0 → 1.0.1`
- **Minor** (new features): `1.0.0 → 1.1.0`
- **Major** (breaking changes): `1.0.0 → 2.0.0`

```bash
# Update version in package.json
npm version patch   # or minor, or major
```

### 3. Push Changes

```bash
# Push the version bump commit
git push origin main
```

This will trigger the `auto-release.yml` workflow which will:
- Create a Git tag
- Publish to NPM automatically

### 4. Create GitHub Release (Optional)

To also publish to GitHub Packages:

1. Go to your GitHub repository
2. Click "Releases" → "Create a new release"
3. Choose the tag that was just created (e.g., `v1.0.1`)
4. Add release notes
5. Click "Publish release"

This triggers the `publish.yml` workflow.

## GitHub Workflows

Your project has three separate, independently runnable workflows:

### 1. Test Pipeline (`test.yml`)
- **Triggers**: Push to main/develop, PRs, manual dispatch
- **Purpose**: Run tests and linting across Node.js versions
- **Manual run**: Go to Actions → Test Pipeline → "Run workflow"

### 2. Build Pipeline (`build.yml`)
- **Triggers**: Push to main, manual dispatch, or called by other workflows
- **Purpose**: Build the project and create artifacts
- **Manual run**: Go to Actions → Build Pipeline → "Run workflow"

### 3. Publish Pipeline (`publish.yml`)
- **Triggers**: GitHub releases, manual dispatch
- **Purpose**: Publish to NPM and GitHub Packages using build artifacts
- **Features**: 
  - Uses artifacts from build pipeline (no rebuilding)
  - Can use existing artifacts from previous builds
  - Option to specify which artifact to use
- **Manual run**: Go to Actions → Publish Pipeline → "Run workflow"

### 4. Auto Release (`auto-release.yml`)
- **Triggers**: Push to main when package.json version changes
- **Purpose**: Automatically create tags and publish when version is bumped

## Prerequisites

### NPM Token
Add `NPM_TOKEN` to your GitHub repository secrets:
1. Go to npmjs.com → Access Tokens → Generate New Token
2. Copy the token
3. In GitHub: Settings → Secrets → Actions → New repository secret
4. Name: `NPM_TOKEN`, Value: your token

### Production Environment (Optional)
For extra safety, create a production environment:
1. GitHub → Settings → Environments → New environment
2. Name: `production`
3. Add protection rules (require reviews, etc.)

## Version Strategy

Follow [Semantic Versioning](https://semver.org/):

- **Major** (`X.0.0`): Breaking changes that require user action
- **Minor** (`0.X.0`): New features that are backward compatible
- **Patch** (`0.0.X`): Bug fixes and small improvements

## Troubleshooting

### Release Failed
- Check the Actions tab for error details
- Ensure NPM_TOKEN is valid
- Verify package.json version was actually changed
- Make sure tests pass: `npm run test:run`

### Package Already Published
- NPM doesn't allow republishing the same version
- Bump the version: `npm version patch`
- Push: `git push origin main`

### Using Existing Build Artifacts

You can publish using previously built artifacts:

1. **Use latest build**: Go to Actions → Publish Pipeline → Run workflow → Use artifact: `latest`
2. **Use specific build**: Find the artifact name from a previous build run → Run workflow → Use artifact: `build-artifacts-abc123def`

### Manual Publishing
If workflows fail, you can publish manually:
```bash
npm run build
npm run test:run
npm publish
```

## Example Release Workflow

Here's a complete example of releasing version 1.2.3:

```bash
# 1. Prepare
git checkout main
git pull origin main
npm run test:run

# 2. Release (this does everything)
npm run release:minor  # 1.2.2 → 1.2.3

# 3. Create GitHub release (optional)
# Go to GitHub → Releases → Create release from v1.2.3 tag
```

That's it! The automation handles the rest.