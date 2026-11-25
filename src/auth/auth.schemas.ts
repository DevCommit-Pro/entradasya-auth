import { z } from 'zod';
import { apiError } from '../common/api-error.js';
// probando ci 
const password = z
  .string()
  .min(1)
  .max(1024)
  .refine(
    (value) => Buffer.byteLength(value.normalize('NFKC'), 'utf8') <= 4096,
  );
export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  password,
});
export const registerSchema = loginSchema.extend({
  name: z.string().trim().min(2).max(80),
  password: password.or(z.literal('')),
  role: z.enum(['customer', 'organizer', 'doorman']).optional(),
});

export function parseLogin(body: unknown) {
  const result = loginSchema.safeParse(body);
  if (!result.success)
    apiError(400, 'invalid_request', 'Revisa el correo y la contraseña.');
  return result.data;
}
export function parseRegister(body: unknown) {
  const result = registerSchema.safeParse(body);
  if (!result.success)
    apiError(
      400,
      'invalid_request',
      'Revisa tu nombre, correo, contraseña y rol.',
    );
  if (result.data.role && result.data.role !== 'customer')
    apiError(
      403,
      'forbidden',
      'El registro público solo permite cuentas de cliente.',
    );
  if (result.data.password.length < 8)
    apiError(
      400,
      'weak_password',
      'La contraseña debe tener al menos 8 caracteres.',
    );
  return result.data;
}
