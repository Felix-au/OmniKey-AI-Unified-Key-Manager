import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: "AIzaSyCPkOnw3BHbSGWEy3CKOKbpdIh9fcT797k",
  authDomain: "omnikey-ai.firebaseapp.com",
  projectId: "omnikey-ai",
  storageBucket: "omnikey-ai.appspot.com",
  messagingSenderId: "367209772393",
  appId: "1:367209772393:web:35586b62d8544d6500445a",
  measurementId: "G-D1DNL01K27"
};

// Initialize Firebase
export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
