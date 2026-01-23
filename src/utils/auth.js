export const ADMIN_USERS = ['hemk3672@gmail.com', 'rojes@gmail.com'];
export const NORMAL_USERS = ['dataentry@gmail.com', 'dataentry1@gmail.com'];

export const loginUser = (email) => {
  if (ADMIN_USERS.includes(email)) {
    return { email, role: 'admin' };
  }
  if (NORMAL_USERS.includes(email)) {
    return { email, role: 'user' };
  }
  return null;
};
