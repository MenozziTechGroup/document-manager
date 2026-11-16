# Releasing DocCenter

Installed apps auto-update from signed GitHub Releases. To ship a new version:

1. **Bump the version in all four places**, or the built app disagrees with itself:
   `src-tauri/tauri.conf.json` (`version`), `package.json`, `src-tauri/Cargo.toml`, and
   the `app` entry in `src-tauri/Cargo.lock`.
2. **Commit** the change.
3. **Get the commit onto `main` before you tag.** The Release workflow fires on any `v*`
   tag from any branch, so tagging an unmerged branch ships a signed release built from
   commits `main` has never seen. That is exactly how `main` sat at v0.1.7 while v0.1.8
   through v0.1.11 shipped and ran on every machine. Merge the branch first (or commit
   straight to `main`), then tag the commit that is on `main`.
4. **Tag and push** — the tag must start with `v`:
   ```
   git tag v0.1.1
   git push origin v0.1.1
   ```
5. The **Release** GitHub Action builds, **signs**, and publishes a **draft** release
   (`.github/workflows/release.yml`).
6. Go to the repo's **Releases**, review the draft, and **publish** it. Installed apps
   pick up the update on next launch.

## Signing key

- Updater artifacts are signed with `TAURI_SIGNING_PRIVATE_KEY` +
  `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`, stored as **GitHub Actions secrets**.
- The matching **public key** is in `tauri.conf.json` (`plugins.updater.pubkey`).
- The private key + password also live in **Keeper**. If the key is ever lost, a new one
  must be generated (`npx tauri signer generate`) and the public key updated — but then
  existing installs can't verify updates and must be reinstalled, so guard the key.

## Local builds (no signing)

For a local/test build without the signing step:
```
npx tauri build --config "{\"bundle\":{\"createUpdaterArtifacts\":false}}"
```

## Code signing (SmartScreen)

The installer is **not** code-signed yet, so Windows SmartScreen warns on first install
("unknown publisher" → More info → Run anyway). Fine for internal use. Buying an
EV/OV code-signing certificate later removes the warning.
