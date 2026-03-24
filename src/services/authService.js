import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import { auth, db, ref, set, get, onValue } from '../firebase';

export const registerUser = async (email, password, role, name) => {
  const cred = await createUserWithEmailAndPassword(auth, email, password);
  await set(ref(db, `users/${cred.user.uid}`), {
    email,
    role,
    name,
    createdAt: Date.now(),
    active: false,
  });
  return cred.user;
};

export const loginUser = (email, password) =>
  signInWithEmailAndPassword(auth, email, password);

export const logoutUser = () => signOut(auth);

export const getUserRole = async (uid) => {
  const snap = await get(ref(db, `users/${uid}`));
  return snap.exists() ? snap.val() : null;
};

export const listenUsers = (cb) => onValue(ref(db, 'users'), cb);
