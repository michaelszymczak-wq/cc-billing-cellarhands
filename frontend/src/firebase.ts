import { initializeApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';

// TODO: Create a new Firebase project for Cellar-Hands and update these values
const firebaseConfig = {
  apiKey: "",
  authDomain: "cc-billing-cellar-hands.firebaseapp.com",
  projectId: "cc-billing-cellar-hands",
  storageBucket: "cc-billing-cellar-hands.firebasestorage.app",
  messagingSenderId: "",
  appId: ""
};

const isDev = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

// Only initialize Firebase when not in local development (avoids errors with empty config)
let auth: Auth;
if (!isDev) {
  const app = initializeApp(firebaseConfig);
  auth = getAuth(app);
} else {
  auth = {} as Auth;
}

export { auth };
