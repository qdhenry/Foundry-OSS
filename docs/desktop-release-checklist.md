# Desktop Release Checklist

1. Update version in `apps/desktop/src-tauri/tauri.conf.json`
2. Update version in `apps/desktop/src-tauri/Cargo.toml`
3. Update version in `apps/desktop/package.json`
4. Commit: `git commit -m "chore(desktop): bump version to X.Y.Z"`
5. Tag: `git tag desktop-vX.Y.Z`
6. Push: `git push origin desktop-vX.Y.Z`
7. GitHub Actions builds all platforms automatically
8. Review draft release on GitHub → edit notes → publish
