export type Role = 'customer' | 'organizer' | 'doorman';
export interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
}
export interface StoredUser extends User {
  passwordHash: string;
}
export function publicUser(user: StoredUser): User {
  return { id: user.id, name: user.name, email: user.email, role: user.role };
}
