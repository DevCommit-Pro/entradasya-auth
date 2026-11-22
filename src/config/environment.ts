import { z } from 'zod';

export function expiryMilliseconds(value: string): number {
  const match = /^([1-9]\d*)(s|m|h|d|w)$/.exec(value);
  if (!match)
    throw new Error(
      'JWT_EXPIRES_IN debe ser una duración positiva (ejemplo: 8h).',
    );
  const factors: Record<string, number> = {
    s: 1000,
    m: 60000,
    h: 3600000,
    d: 86400000,
    w: 604800000,
  };
  const milliseconds = Number(match[1]) * factors[match[2]];
  if (!Number.isSafeInteger(milliseconds))
    throw new Error('JWT_EXPIRES_IN está fuera de rango.');
  return milliseconds;
}

const schema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(4001),
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('8h'),
});

export function validateEnvironment(input: Record<string, unknown>) {
  const result = schema.safeParse(input);
  if (!result.success) {
    // Do not include input values (including secrets) in configuration errors.
    throw new Error(
      `Configuración no válida: ${result.error.issues.map((issue) => issue.path.join('.')).join(', ')}`,
    );
  }
  expiryMilliseconds(result.data.JWT_EXPIRES_IN);
  return result.data;
}
