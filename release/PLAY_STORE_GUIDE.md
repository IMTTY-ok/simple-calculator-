# Publishing Calculator to Google Play

A step-by-step guide written for someone who has never released an Android app.
Nothing here requires any technical knowledge beyond copying files into the
right folders.

---

## 1. The two files, and which is which

Both files live in the **`release/`** folder of this project.

| File | What it is | What you do with it |
| --- | --- | --- |
| `release/calculator-release.aab` | **Android App Bundle** — the upload format Google Play requires for new apps. | Upload this to Google Play Console. |
| `release/calculator-test.apk` | **APK** — a directly installable package. | Install this on your own phone to try the app. |

> If you only ever upload **one** thing to Google, it is the `.aab`.
> Play Store listings do **not** accept `.apk` files for new apps.

Both files are already signed with your release key, so you can upload or
install them right now. They are committed to the repository for convenience;
rebuild them at any time with `npm run android:aab` and `npm run android:apk`.

---

## 2. Before you start: the one-time setup

### 2.1 Create a Google Play developer account

1. Go to **<https://play.google.com/console>**
2. Sign in with the Google account you want to own the app.
3. Click **Get started** and pay the **$25 one-off registration fee** (paid
   once, not per app).
4. Fill in the account details. You are asked for:
   - **Your legal name and address** — this appears on the public Play Store
     listing for an individual account.
   - **A contact email and phone number.**
   - **Whether the account is personal or an organisation.**
     - *Personal* is simplest, but see the closed-testing note below.
     - *Organisation* requires a D-U-N-S number and a public website, and is
       only worth it if you are publishing on behalf of a company.

> **Do this step first.** Google sometimes asks you to verify your identity
> with the Play Console mobile app before it will let you create a release.

### 2.2 The important rule about personal accounts

If your account is **personal** and was created **after 13 November 2023**,
Google requires you to run a **closed test** before you can publish to
production:

- Create a closed testing track.
- Get **at least 12 testers** to opt in.
- Keep those 12 testers opted in **continuously for 14 days**.
- Only then can you apply for **production access**.

This takes about **two weeks minimum** and cannot be shortened. Start it as
soon as you create the account — it is the longest pole in the whole process.

Organisation accounts do not have this requirement.

---

## 3. Create the app listing

1. In Play Console, click **Create app**.
2. Fill in:
   - **App name**: `Calculator`
   - **Default language**: English
   - **App or game**: App
   - **Free or paid**: Free
   - **Declarations** (tick the boxes confirming you have followed the
     content policy and that the app is not restricted)
3. Click **Create app**. This creates the listing shell — it is not public
   until you actually publish a release.

---

## 4. Fill in the store listing

Everything you need is already prepared in this project. The text files are
ready to copy and paste.

### 4.1 The main store listing

Open **Store presence → Main store listing** in Play Console and fill in:

| Play Console field | Copy this from |
| --- | --- |
| App name | `Calculator` |
| Short description | `store-assets/short-description.txt` |
| Full description | `store-assets/full-description.txt` |
| App icon | `store-assets/icon/icon-512.png` (512 × 512 PNG) |
| Feature graphic | `store-assets/feature-graphic/feature-graphic-1024x500.png` (1024 × 500 PNG) |
| Phone screenshots | the files in `store-assets/screenshots/` — upload at least 2, all 6 are ready |
| Category | `Tools` (see `store-assets/category.txt` for why) |

**Contact details**

| Field | What to enter |
| --- | --- |
| Email | an address you actually read — Google sends review results there |
| Phone | optional but recommended; Google may call with questions |
| Website | your repository or a simple landing page (see step 6 for the privacy policy) |

### 4.2 Release notes for the first version

`store-assets/release-notes.txt` contains the text to paste into the release
notes box.

---

## 5. Upload the release

1. Go to **Release → Testing → Closed testing** (or **Production** if you
   already have production access).
2. Click **Create new release**.
3. Leave the release name as the default, or call it `1.0.0`.
4. Click **Upload asset** and choose
   `release/calculator-release.aab`.
5. Wait for the upload and processing to finish (usually a minute).
6. Play shows **Release notes** and **App bundle explorer**:
   - Paste the release notes from `store-assets/release-notes.txt`.
   - Open the **App bundle explorer** and look at the device list. It should
     show many devices with a green tick. If it shows errors, take a
     screenshot and ask for help.
7. Click **Save**, then **Review release**, then **Start rollout to Closed
   testing**.
8. Add your 12 testers to the closed testing track (**Testing → Closed
   testing → Testers → Manage testers**).

---

## 6. Publish the privacy policy on the web

Google Play will not accept a privacy policy that only exists inside the app
or as a file on your computer. It must be a **public web page that anyone
can open over HTTPS without logging in**.

You already have the page: **`privacy-policy.html`** in the project root.

### Option A — GitHub Pages (free, simplest)

1. Push the project to GitHub (already done).
2. Open the repository on GitHub → **Settings → Pages**.
3. Under **Source**, choose **Deploy from a branch**, branch **`main`**,
   folder **`/ (root)`**. Click **Save**.
4. Wait about a minute, then your policy is live at:
   `https://IMTTY-ok.github.io/simple-calculator-/privacy-policy.html`
   (the exact folder name comes from the repository name).
5. Copy that address into Play Console under
   **Policy → App content → Privacy policy → URL**.

### Option B — any other host

Upload `privacy-policy.html` to any static host (Netlify, Vercel, GitHub
Pages, your own site) and use that address.

### Option C — Google Sites / Drive

If you have no hosting at all, Google Sites can host the page for free. Copy
the text into a Google Site and publish it publicly.

> The app also shows the same policy **inside the app** (Settings → About →
> Privacy policy), which works offline. The web page is only needed for the
> Play Console requirement.

---

## 7. Complete the "App content" declarations

In Play Console, open **Policy → App content**. You must complete every
section. Here is what to answer for this app:

| Section | What to select | Why |
| --- | --- | --- |
| **Privacy policy** | Paste your published URL (step 6) | Required for every app |
| **Ads** | **No ads** | The app contains no advertising |
| **App content > News app** | Not a news app | |
| **App content > COVID-19 app** | Not a COVID-19 app | |
| **Content ratings** | Complete the questionnaire → category **Utility, Productivity, Communication or Other** → it will be rated for everyone | It is a utility app with no objectionable content |
| **Target audience** | Pick **18 and over** (or 13+ if you want to include younger users) — the calculator has no age gate, so this is a declaration, not a restriction | |
| **News app** | No | |
| **Government apps** | No | |
| **Financial features** | **No** — the app does not lend money, offer financial products, or display stock/balance information | |
| **Health** | No | |
| **Permissions** | `VIBRATE` and `INTERNET` are auto-detected from the app bundle. `VIBRATE` is used for the haptic feedback you feel on each key press. `INTERNET` is required by the Android WebView runtime that renders the interface; the app itself makes no network requests. | Declare both if the form asks |
| **Data safety** | See `release/PRIVACY_AND_DATA_SAFETY.md` — it has the exact answers | |
| **App access** | State that **all functionality is available without special access** | There are no login-gated features |

---

## 8. Request production access

Once the closed test has run for 14 days with 12 testers:

1. **Testing → Closed testing → Apply for production**.
2. Answer the short questionnaire honestly (it is mostly about ads,
   content and data handling).
3. Google reviews it, usually within a few days.

---

## 9. Release to production

1. **Release → Production → Create new release**.
2. Upload `release/calculator-release.aab` again (the same file — Google
   remembers versions by version code, so if you upload the identical bundle
   twice you must bump the version code. If Play complains, ask and the
   version code can be incremented in `android/app/build.gradle`).
3. Paste the release notes.
4. **Start rollout to Production**.

You can choose to roll out to **10% → 50% → 100%**, which is a good way to
catch problems early. Stop the rollout from the Play Console if something
looks wrong.

---

## 10. What happens next

- **Review** usually takes a few days, sometimes up to two weeks for a first
  app.
- You can watch progress under **Release → Production → Pending release**.
- If Google asks for something, the message appears in the Play Console
  notification bell and by email.
- When it is approved, your app is live at
  `https://play.google.com/store/apps/details?id=com.imtty.calculator`.

---

## 11. Updates after the first release

Every future release must be signed with **the same key** you used for the
first one. If you lose that key, Google will not let you update the app
again — you would have to publish a completely new listing.

Your key and its passwords are stored **outside the repository** in:

```
C:\Users\LENOVO\.pulse-calc-signing\calculator-release.jks
C:\Users\LENOVO\.pulse-calc-signing\SIGNING-CREDENTIALS.txt
```

**Back both of those up somewhere safe and private** — an encrypted drive, a
password manager, an offsite backup. They are not in the git repository, on
purpose.

To build a later version, bump the two numbers in `android/app/build.gradle`:

```gradle
versionCode 2        // must be higher than the last upload
versionName "1.0.1"  // what users see
```

---

## 12. A quick troubleshooting list

| Problem | What it means | What to do |
| --- | --- | --- |
| "App bundle explorer" shows errors | The bundle does not support some device versions | Send me the screenshot — the bundle is verified locally |
| Play says the version code has already been used | You uploaded the same build twice | Increase `versionCode` and rebuild |
| Closed testing says "not enough testers" | Fewer than 12 testers have opted in | Invite more people; they must stay opted in for 14 days |
| "Your app needs a privacy policy URL" | The policy is not published on the web | Do step 6 |
| "Target API level must be 36" | Google requires recent API levels | This build already targets API 36 |
| Permission "INTERNET" appears in the form | The WebView runtime declares it | Select it; explain it in the notes if asked |

---

## 13. Where everything is

```
release/
  calculator-release.aab     <- upload this to Google Play
  calculator-test.apk        <- install this on your phone
  PLAY_STORE_GUIDE.md        <- this file
  RELEASE_CHECKLIST.md       <- tick this off before you upload
  PRIVACY_AND_DATA_SAFETY.md <- exact answers for the Data safety form

store-assets/
  icon/icon-512.png                        <- Play Store icon
  feature-graphic/feature-graphic-1024x500.png
  screenshots/01..06-*.png                  <- real phone screenshots
  short-description.txt
  full-description.txt
  release-notes.txt
  category.txt
  keywords.txt

privacy-policy.html                        <- publish this on the web
```

---

Google Play Console changes its screens from time to time. If a button is not
where this guide says, the Play Console help centre is always the final
authority: <https://support.google.com/googleplay/android-developer>
