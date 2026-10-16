# शाला-सेतु (ShalaSetu) — School App + Principal Dashboard

A responsive, installable web app (PWA) with two views that use the same school database:

- `index.html` — teacher/operator staff app: student master list, CSV import/export, exam marks, results archive, fee requests and school notices.
- `dashboard.html` — principal dashboard: live overview, student list, fee approvals/ledger, notices, staff accounts, school settings and JSON backup.

The UI and data model are ready, but **real cloud login/live sync is intentionally not enabled until you add your own Firebase project configuration**. No Firebase project credentials were attached. The app will not pretend that local demo data is a live cloud database.

## What works, and where

| Feature | Cloud mode | Demo preview |
|---|---|---|
| Email/password login | Firebase Authentication | Not a real login; choose a sample role |
| Role checks | Firebase Authentication + Realtime Database rules | UI preview only; never secure enough for real records |
| Student/results/fees/notices | Firebase Realtime Database | This browser's local storage only |
| Live updates | Realtime Database listeners across signed-in devices | Same-browser local demo only |
| Google Sheets | Export CSV and open it in Sheets | CSV export |
| App updates | Redeploy one hosted URL; installed PWA checks for updates | Local preview |

**Google Sheets is not used as the live database.** Student/fee data is better kept behind database security rules. CSV files open in Google Sheets, but this package does not provide two-way live Sheets sync.

## 1. Create a free Firebase project

1. Create a Firebase project and keep it on the **Spark (no-cost) plan**. Do not attach billing if you require a no-charge setup.
2. In **Project settings → General → Your apps**, add a **Web app** and copy its web configuration.
3. Open `firebase-config.js` and replace the five `REPLACE_WITH_...` values:
   - `apiKey`
   - `authDomain`
   - `databaseURL` — copy the exact Realtime Database URL shown by Firebase (it may end with `firebasedatabase.app` or `firebaseio.com`).
   - `projectId`
   - `appId`
4. Leave `schoolId: "my-school"` as-is for the first setup, or change it once. The same value must be used in the database seed below.
5. In **Authentication → Sign-in method**, enable **Email/Password**.
6. In **Realtime Database**, create a database. Choose the closest available region, then open **Rules** and replace them with the contents of `database.rules.json`. Publish the rules.

The Firebase web config is a public client identifier, not a password. **Never put a Firebase service-account JSON, private key, staff password, or student backup in this website folder.**

## 2. Create the first Principal login

The app deliberately has no public sign-up or hard-coded sample passwords. Bootstrap the first principal once from Firebase Console:

1. In **Authentication → Users → Add user**, create the principal's email/password login. Keep the password private.
2. Copy that user's **UID** from the Authentication users list.
3. In **Realtime Database → Data**, create this path and replace the example values:

```json
{
  "schools": {
    "my-school": {
      "users": {
        "PASTE_PRINCIPAL_UID_HERE": {
          "name": "School Principal",
          "email": "principal@your-school.in",
          "role": "principal",
          "createdAt": 1792108800000
        }
      },
      "settings": {
        "schoolName": "Your school name",
        "schoolNameEn": "Your school name in English",
        "schoolAddress": "Your school address",
        "academicSession": "2026-27",
        "classes": ["5th", "8th", "10th"]
      }
    }
  }
}
```

If you changed `schoolId` in `firebase-config.js`, replace `my-school` in the path above with that exact value. The console is the one-time bootstrap route; the app's Principal screen can then create teacher/operator logins and assign their roles. **Passwords are never listed or saved in the school database.**

For Firebase Authentication to accept the hosted app, add its hostname under **Authentication → Settings → Authorized domains** (for example, `yourname.github.io` for GitHub Pages). Add `localhost` if testing on a local web server.

## 3. Host the app for free

### GitHub Pages (simple static hosting)

1. Make a GitHub repository and upload the **contents** of this `shalasetu` folder to its root.
2. Do not upload real student data, database exports, screenshots, or passwords to the repository.
3. In the repository, open **Settings → Pages**. Choose **Deploy from a branch**, then `main` and `/ (root)`.
4. Wait for the published URL. Add that URL's hostname to Firebase Authentication's authorized domains.
5. Share the same published URL with staff. Use `index.html` for the staff app and `dashboard.html` for the principal dashboard.

The site files are client-side code, so the repository may be public on GitHub Free. The database is **not** public if you publish the supplied rules and keep the bootstrap profile safe. Anyone can see website code/config, but only accounts granted a school role can read school data.

You can also publish the same files with Firebase Hosting. Keep the Firebase web config in `firebase-config.js` and keep the Realtime Database rules locked down either way.

## 4. Test and install

- To test locally, serve the folder over HTTP (not `file://`). For example, from this directory run `python3 -m http.server 8080`, then open `http://localhost:8080`.
- Use the **Principal demo** or **Teacher demo** button to preview the interface before connecting Firebase. The banner will say **DEMO — local browser data only**.
- Once Firebase is configured, sign in with the principal account created above. Add teacher/operator accounts from **Staff accounts** in the dashboard.
- On Android Chrome, open the hosted URL and choose **Install app / Add to Home screen**. On iPhone Safari, use **Share → Add to Home Screen**.

## Roles in this starter

- **Teacher:** view/add/edit students, create and publish class results, submit fee requests, view shared notices.
- **Operator:** view student/results data, approve or reject fee requests, view the ledger and notices.
- **Principal:** all staff features, fee approvals, notices, staff accounts, school settings and backups.

The Firebase security rules are the real boundary; hiding a button in the UI is not security. The rules deny public access and prevent staff from assigning themselves a principal role. The first Principal role must be seeded by the owner in the Firebase Console.

## Automatic updates

Install/share **one hosted PWA URL**, not separate copies. When you publish changed files to that same URL, the service worker checks for the latest app shell; users receive it on their next online visit/reload. A page already open may need a refresh. A PWA update does not require sending a new APK for each code change. If each person instead hosts a separate copy or installs a native APK built from a separate project, those copies do not update from this site.

## Free-tier and privacy notes

Firebase and GitHub Pages have free/no-cost options, but free tiers have usage limits and are not unlimited. Check current quotas before entering real records. The app intentionally uses no paid image storage, SMS service, payment gateway, or external spreadsheet service. Keep regular private backups, use strong unique passwords, and limit the school database to the minimum personal data you need. Follow your school's parent/guardian consent and data-retention policies.

This starter is not a parent/student portal, attendance system, official board integration, payment gateway, or native Android APK. The installed PWA is the free cross-device route: one hosted app, one login system, one shared live database.

## Useful official references

- Firebase pricing: https://firebase.google.com/pricing
- Firebase Realtime Database security: https://firebase.google.com/docs/database/security
- Firebase Authentication email/password: https://firebase.google.com/docs/auth/web/password-auth
- GitHub Pages: https://docs.github.com/en/pages/getting-started-with-github-pages/what-is-github-pages
