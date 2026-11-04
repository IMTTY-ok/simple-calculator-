# Privacy and Google Play Data Safety

This guide contains the exact answers for the **Data safety** form in Google
Play Console, plus the reasoning behind each one. Every statement here was
checked against the actual application and its dependencies — not assumed.

---

## 1. What the app actually does (the short version)

- Every calculation runs **inside the app on your phone**.
- Settings and the last 50 calculations are stored in the device's own local
  storage.
- **Nothing is ever transmitted anywhere.** There is no server, no account, no
  analytics, no advertising, no crash reporting and no third-party SDK.

---

## 2. The dependency audit

Before answering the form, every dependency in the project was checked for
data collection or outbound communication.

| Dependency | Purpose | Network activity |
| --- | --- | --- |
| `react`, `react-dom` | UI | None |
| `motion` | Animation | None |
| `lucide-react` | Icons | None |
| `@fontsource-variable/inter`, `.../jetbrains-mono` | Self-hosted fonts | **None** — the font files are bundled inside the app |
| `@capacitor/core`, `android`, `cli` | Native bridge | None — local IPC only |
| `@capacitor/haptics` | Vibration | None |
| `@capacitor/status-bar` | System bar appearance | None |
| `@capacitor/splash-screen` | Launch screen | None |
| `@capacitor/app` | Android back button | None |
| `vite-plugin-pwa` / Workbox | Web offline support (web build only) | None — caches the app's own local files |

**How this was verified:** the production JavaScript bundle was scanned for
every `http://` and `https://` address. The only matches were XML namespace
identifiers (`http://www.w3.org/2000/svg` and similar) and a documentation
link inside a React error message — **none of which is a network request**.
There are no analytics endpoints, no fonts loaded from a CDN, and no
third-party scripts.

**Runtime permissions:** the app requests **no runtime permissions**. The
Android package declares two:

- `android.permission.VIBRATE` — required for the haptic feedback on each key
  press. It is granted automatically at install time and prompts the user for
  nothing.
- `android.permission.INTERNET` — required by the Android WebView runtime that
  renders the interface. The app makes **no** network requests with it. It is
  not optional, because the WebView cannot load even its own bundled
  `https://localhost` assets without it.

---

## 3. The Data safety form — exact answers

Open **Play Console → Policy → App content → Data safety**.

### Question 1 — Does your app collect or share any of the required user data types?

> **No — my app does not collect or share any user data.**

**Why this is correct:** Google's definition of "collect" is *transmitting data
off the device*. The calculation history and the settings never leave the
phone. They are written to the app's own local storage and read back from
there. Nothing is transmitted, so nothing is collected or shared.

The form will now let you skip the per-data-type questions.

### Question 2 — Is all of the user data collected by your app encrypted in transit?

> Not applicable — no data is collected.

### Question 3 — Do you provide a way for users to request that their data is deleted?

> **Yes.**

Even though no data is collected, this is a good answer to give, because the
app genuinely offers a deletion path:

- **Settings → Clear history → Clear** removes every stored calculation.
- Uninstalling the app removes everything as well.

If the form does not ask the question (because you answered "no data
collected"), simply skip it.

### Question 4 — Do you collect data from children?

> **No — my app does not collect any user data.**

Because no data is collected from anyone, no data is collected from children.
The app contains no ads, no purchases, no chat, no links out and no
personalisation.

### If the form still asks for data types

If you selected "no data collected" it will skip the rest. If it still shows
the data-type list, choose **"No data collected or shared"** for every
category, and make sure the summary at the top says **"No data collected or
shared"** and **"No data shared with third parties"**.

---

## 4. Other declarations that reference this policy

| Form | Answer | Why |
| --- | --- | --- |
| **Privacy policy URL** | Your published `privacy-policy.html` URL | Required for every app. Publish it first — see `PLAY_STORE_GUIDE.md` step 6. |
| **Ads** | No ads | There is no advertising SDK and no ad placement. |
| **App access** | All functionality is available without special access | There is no login, no code gate and no restricted area. |
| **Permissions** | Declare `VIBRATE` and `INTERNET` | Both are auto-detected from the bundle. `VIBRATE` is the haptic feedback; `INTERNET` is the WebView runtime. |
| **Financial features** | No | The app does not lend money, offer financial products, or show balances or stock prices. |
| **Content rating** | Everyone | It is a utility app with no objectionable content. |
| **Target audience** | 18 and over (or 13 and over) | This is a declaration of the intended audience, not a restriction the app enforces. |

---

## 5. Privacy policy publishing

The policy page already exists: **`privacy-policy.html`** in the project root.
It is a complete, self-contained page with no external fonts or scripts, so it
renders correctly wherever you host it.

**It must be publicly reachable over HTTPS.** A file on your computer or a
link that needs a sign-in will be rejected.

The quickest free option is GitHub Pages:

1. Repository → **Settings → Pages**
2. **Source**: Deploy from a branch, branch `main`, folder `/ (root)`
3. Wait a minute, then use
   `https://IMTTY-ok.github.io/simple-calculator-/privacy-policy.html`

Other options: Netlify Drop (drag the file onto <https://app.netlify.com/drop>),
Vercel, or any web host.

> The same policy is **also inside the app** (Settings → About → Privacy
> policy). It ships with the app and works with no connection at all. The web
> copy exists only because Play requires a URL.

---

## 6. Reviewing the app yourself

Before you submit, open the app and confirm every claim in this document:

- [ ] Turn on airplane mode, close the app, reopen it → it still works
- [ ] Make a calculation, open Settings → Clear history → Clear → the history is empty
- [ ] Settings → About → Privacy policy → the page opens
- [ ] No permission dialog appears at any point
- [ ] The app does not request the network in any way you can observe

If any of these behave differently from what is written here, fix the app
before submitting — Google reviews the actual behaviour, and a mismatch
between the declaration and the app is one of the most common reasons for a
rejection.

---

## 7. Why the app declares no data, in one paragraph

The app has no backend at all. There is no server to send anything to, no
analytics library to phone home with, no advertising SDK to share identifiers
with, and no account system that could identify you. The calculation engine
is a pure function running in the app's own JavaScript runtime, and the only
things it writes are the settings and the calculation history — both in the
device's own local storage, both readable and deletable by you at any time.
Android's cloud backup and device-transfer are explicitly disabled for the
app, so even the operating system does not copy that data anywhere else.
