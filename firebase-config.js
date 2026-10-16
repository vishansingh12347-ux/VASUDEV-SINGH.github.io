// Firebase Web App configuration. These values identify your Firebase project;
// they are not service-account secrets. Replace the placeholders using the setup guide.
export const firebaseConfig = {
  apiKey: "AIzaSyBuQaOVX0Z5YQIQ1wFhVSLpKR092mM2g6M",
  authDomain: "bssr-8815d.firebaseapp.com",
  databaseURL: "https://bssr-8815d-default-rtdb.firebaseio.com",
  projectId: "bssr-8815d",
  storageBucket: "bssr-8815d.firebasestorage.app",
  messagingSenderId: "1071519059072",
  appId: "1:1071519059072:web:a67cb9f53a416249e3ea65"
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
