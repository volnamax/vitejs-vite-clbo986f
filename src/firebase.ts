import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyAZHby4rDsELTtKDaDv2XunDGXBX4J4DrE",
  authDomain: "life-quest-47504.firebaseapp.com",
  projectId: "life-quest-47504",
  storageBucket: "life-quest-47504.firebasestorage.app",
  messagingSenderId: "105561939855",
  appId: "1:105561939855:web:94fe96fe17b808f560b5fa"
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();