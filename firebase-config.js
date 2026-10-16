// Firebase Web App configuration. These values identify your Firebase project;
// they are not service-account secrets. Replace the placeholders using the setup guide.
export const firebaseConfig = {
  apiKey: "REPLACE_WITH_FIREBASE_WEB_API_KEY",
  authDomain: "REPLACE_WITH_PROJECT_ID.firebaseapp.com",
  databaseURL: "https://REPLACE_WITH_DATABASE_URL",
  projectId: "REPLACE_WITH_PROJECT_ID",
  appId: "REPLACE_WITH_FIREBASE_APP_ID"
};

// Keep the same schoolId in the Firebase database seed and the security rules setup.
export const appSettings = {
  schoolId: "my-school",
  schoolName: "बाबा श्री श्री रामदेव स्कूल, मंडला कलां",
  schoolNameEn: "BABA SHRI SHRI RAMDEV SCHOOL, MANDLA KALLAN",
  schoolAddress: "Mandla Kallan, Rajasthan",
  academicSession: "2026-27",
  classes: ["5th", "8th", "10th"],
  subjectsByClass: {
    "5th": [
      { name: "हिंदी", max: 100 },
      { name: "English", max: 100 },
      { name: "गणित", max: 100 },
      { name: "पर्यावरण अध्ययन", max: 100 }
    ],
    "8th": [
      { name: "हिंदी", max: 100 },
      { name: "English", max: 100 },
      { name: "गणित", max: 100 },
      { name: "विज्ञान", max: 100 },
      { name: "सामाजिक विज्ञान", max: 100 }
    ],
    "10th": [
      { name: "हिंदी", max: 100 },
      { name: "English", max: 100 },
      { name: "गणित", max: 100 },
      { name: "विज्ञान", max: 100 },
      { name: "सामाजिक विज्ञान", max: 100 }
    ]
  }
};
