// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyBKlPQFBXPEmrYI3eHkEY2NHwMrP-enBZw",
    authDomain: "data-entry-system-7ed74.firebaseapp.com",
    projectId: "data-entry-system-7ed74",
    storageBucket: "data-entry-system-7ed74.firebasestorage.app",
    messagingSenderId: "325458354960",
    appId: "1:325458354960:web:8d5d5e409c14b0a4e93b95",
    measurementId: "G-HYH6D11K5R"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Services
export const db = getFirestore(app);
export const auth = getAuth(app);
