import { db, ref, remove, set, get } from '../firebase';

export const addUserRecord = (uid, data) => set(ref(db, `users/${uid}`), data);

export const deleteUserRecord = (uid) => remove(ref(db, `users/${uid}`));

export const getWhatsAppNumbers = async () => {
  const snap = await get(ref(db, 'settings/whatsappNumbers'));
  return snap.exists() ? snap.val() : {};
};

export const saveWhatsAppNumbers = (numbers) =>
  set(ref(db, 'settings/whatsappNumbers'), numbers);
