# Release checklist

Tick every box before you upload anything. This list exists so that a
mistake is caught on your own phone, not by Google after a two-week review.

---

## A. The build

- [x] **Type check passes** — `npm run typecheck` (no errors)
- [x] **Lint passes** — `npm run lint` (no warnings)
- [x] **Python test suite passes** — `npm run test:python` → **183 passed**
- [x] **Engines agree on random input** — `npm run test:fuzz` → 0 mismatches over 80 000 random key sequences
- [x] **Engines agree after an error** — `npm run test:parity` → 0 mismatches over every action taken from every error state
- [x] **Frontend production build succeeds** — `npm run build`
- [x] **Android bundle built** — `android/app/build/outputs/bundle/release/app-release.aab`
- [x] **Android APK built** — `android/app/build/outputs/apk/release/app-release.apk`
- [x] **Both artefacts copied to `release/`**
- [x] **APK signature verified** — `apksigner verify` reports *Verifies*
- [x] **AAB signature verified** — `jarsigner -verify` reports *signature was verified*
- [x] **No service worker in the Android bundle** — the native app ships its own assets
- [x] **No development-server URLs in the bundle** — verified by scanning the built JavaScript
- [x] **Application ID** — `com.imtty.calculator`
- [x] **Version name** — `1.0.0`
- [x] **Version code** — `1`
- [x] **Target SDK** — 36
- [x] **Minimum SDK** — 24 (Android 7.0), which covers Android 8.0 and newer

## B. On a real phone — **this part is still open**

> These require physical hardware. They have **not** been performed, because
> no Android device was available during the build. Please work through this
> list before uploading.

- [ ] **Fresh install** — `release/calculator-test.apk` installs without errors
- [ ] **First launch** — the app opens to the calculator, not a blank screen
- [ ] **Splash screen** — the launch artwork appears and is dismissed
- [ ] **Icon on the launcher** — the adaptive icon looks right (not cropped)
- [ ] **App name on the launcher** — reads "Calculator"
- [ ] **Haptics** — every key press produces a distinct physical pulse
      (light for digits, firmer for operators, a confirmation pulse for `=`)
- [ ] **Haptics off** — turning the setting off silences them completely
- [ ] **Dark theme** — the app opens in dark and the status bar matches
- [ ] **Light theme** — switching in Settings updates the status bar too
- [ ] **Restart** — close the app fully, reopen it: history and settings survive
- [ ] **Airplane mode** — turn on airplane mode, close and reopen the app:
      it still opens and still calculates
- [ ] **History** — a calculation appears in History and survives a restart
- [ ] **Reuse from history** — tapping an entry puts the result back on the display
- [ ] **Back button** — with a panel open, back closes the panel; with no
      panel open, back exits the app
- [ ] **Small screen** — a 5-inch phone fits the keypad without scrolling
- [ ] **Large screen** — a tablet or a large phone looks right, not stretched
- [ ] **No permission prompts** — the app never asks for anything
- [ ] **Privacy policy** — Settings → About → Privacy policy opens the page

## C. The store listing

- [ ] Icon uploaded (512 × 512 PNG, `store-assets/icon/icon-512.png`)
- [ ] Feature graphic uploaded (1024 × 500 PNG)
- [ ] At least **2** phone screenshots uploaded (6 are ready in `store-assets/screenshots/`)
- [ ] Short description pasted from `store-assets/short-description.txt`
- [ ] Full description pasted from `store-assets/full-description.txt`
- [ ] Release notes pasted from `store-assets/release-notes.txt`
- [ ] Category set to **Tools**
- [ ] Contact email and phone filled in
- [ ] Privacy policy URL published on a **public HTTPS** page and pasted in

## D. Play Console declarations

- [ ] Privacy policy URL entered
- [ ] **Ads**: "No ads"
- [ ] Content rating questionnaire completed
- [ ] Target audience selected
- [ ] Financial features: "No"
- [ ] Data safety form completed (answers in `PRIVACY_AND_DATA_SAFETY.md`)
- [ ] Permissions declaration matches the app
- [ ] App access: "All functionality is available without special access"

## E. Before you press "Start rollout"

- [ ] Closed test running with **12 testers** opted in
- [ ] The 14-day continuous opt-in period has passed
- [ ] Production access granted
- [ ] `release/calculator-release.aab` uploaded to the production track
- [ ] Version code is **higher** than any previous upload

---

## Sign-off

```
Release built by :  ______________________   Date: ____________
Phone testing by :  ______________________   Date: ____________
Uploaded by      :  ______________________   Date: ____________
```
