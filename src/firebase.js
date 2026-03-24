import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getDatabase, ref, push, set, onValue, update, remove, get } from "firebase/database";

const firebaseConfig = {
    apiKey: "AIzaSyBKlPQFBXPEmrYI3eHkEY2NHwMrP-enBZw",
    authDomain: "data-entry-system-7ed74.firebaseapp.com",
    databaseURL: "https://data-entry-system-7ed74-default-rtdb.firebaseio.com",
    projectId: "data-entry-system-7ed74",
    storageBucket: "data-entry-system-7ed74.firebasestorage.app",
    messagingSenderId: "325458354960",
    appId: "1:325458354960:web:8d5d5e409c14b0a4e93b95",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getDatabase(app);
export { ref, push, set, onValue, update, remove, get };
