# QuotaGem 2.0 Release Checklist

## Recommended Artifact

Use the portable package as the primary Windows release artifact:

```powershell
npx tauri build
npm run package:portable
```

Expected output:

```text
src-tauri\target\release\bundle\portable\QuotaGem_2.0.0_x64-portable.zip
```

## Verified Locally

- `npm test`: 24 test files passed, 92 passed, 1 skipped.
- `npx tauri build`: produced release exe plus MSI/NSIS bundles.
- `npm run package:portable`: produced the portable zip.
- Microsoft Defender scan of the portable zip: no threats found.
- Portable zip extracted to a different folder and launched successfully.
- Launching the portable exe twice left one `quotagem.exe` process.
- With `launchAtLogin: true`, Windows `HKCU\Software\Microsoft\Windows\CurrentVersion\Run\QuotaGem` updates to the current portable exe path.
- Moving the portable exe and launching it once updates the startup entry to the new path.

## Installer Status

Do not promote NSIS/MSI as the default download yet.

- NSIS static scan found no threats, but the install flow triggered Microsoft Defender `Trojan:Win32/Bearfoos.A!ml` quarantine on the installed `quotagem.exe`.
- MSI static scan found no threats, but silent install failed with Windows Installer error `1925` because the generated MSI defaults to all-users install metadata and needs administrator privileges.
- Keep MSI/NSIS as build outputs for now, but publish portable zip first until signing and Defender false-positive review are resolved.

## Before Publishing

- Re-run `npm test`.
- Re-run `npx tauri build`.
- Re-run `npm run package:portable`.
- Scan the portable zip with Microsoft Defender.
- Launch the portable exe twice and confirm only one process remains.
- Confirm launch-at-login writes the current portable exe path.
