import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import type { TestingModule } from '@nestjs/testing';
import { HttpException } from '@nestjs/common';
import { JwtSigner, JwtVerifier, PasswordHasher } from '@nestjs/authentication';
import { AppModule } from '../app.module.js';
import { AuthService } from './auth.service.js';
import { UsersRepository } from '../users/users.repository.js';
import {
  validateEnvironment,
  expiryMilliseconds,
} from '../config/environment.js';
// prueba de CI
const secret = process.env.JWT_SECRET!;
const verifier = new JwtVerifier({
  key: secret,
  algorithms: ['HS256'],
  required: ['sub', 'name', 'email', 'role', 'iat', 'exp'],
});
let module: TestingModule;
let auth: AuthService;
let users: UsersRepository;
beforeAll(async () => {
  module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PasswordHasher)
    .useValue(new PasswordHasher({ logN: 10 }))
    .compile();
  await module.init();
  auth = module.get(AuthService);
  users = module.get(UsersRepository);
});
afterAll(async () => {
  await module?.close();
});

async function error(promise: Promise<unknown>, status: number, code: string) {
  try {
    await promise;
    throw new Error('Expected failure');
  } catch (exception) {
    expect(exception).toBeInstanceOf(HttpException);
    expect((exception as HttpException).getStatus()).toBe(status);
    expect((exception as HttpException).getResponse()).toMatchObject({
      error: { code, message: expect.any(String) },
    });
  }
}

describe('auth contract — real module, memory repository and JWT', () => {
  it.each([
    ['cliente@entradasya.bo', 'customer'],
    ['andrea.vargas@entradasya.bo', 'customer'],
    ['lfpaz@entradasya.bo', 'customer'],
    ['organizador@entradasya.bo', 'organizer'],
    ['valeria@productoraandes.bo', 'organizer'],
    ['portero@entradasya.bo', 'doorman'],
  ])('logs in seeded %s with role %s and valid claims', async (email, role) => {
    const result = await auth.login({ email, password: 'entradas123' });
    const claims = await verifier.verify(result.token);
    expect(claims).toMatchObject({
      sub: result.user.id,
      name: result.user.name,
      email,
      role,
    });
    expect(claims.exp! - claims.iat!).toBe(28800);
    expect(Object.keys(result.user).sort()).toEqual([
      'email',
      'id',
      'name',
      'role',
    ]);
    expect(claims).not.toHaveProperty('passwordHash');
  });
  it('registers normalized email/name, ignores injected privileged fields', async () => {
    const result = await auth.register({
      name: '  Ana Pérez ',
      email: ' ANA@Example.com ',
      password: 'entradas123',
      id: 'u-door-1',
      organizerId: 'x',
    });
    expect(result.user).toMatchObject({
      name: 'Ana Pérez',
      email: 'ana@example.com',
      role: 'customer',
    });
    expect(result.user.id).not.toBe('u-door-1');
    expect(await verifier.verify(result.token)).toMatchObject({
      sub: result.user.id,
    });
    const stored = users.findByEmail('ana@example.com')!;
    expect(stored.passwordHash).toMatch(/^\$scrypt\$/);
    expect(stored.passwordHash).not.toContain('entradas123');
    await error(
      auth.register({
        name: 'Ana',
        email: 'ANA@example.com',
        password: 'entradas123',
      }),
      409,
      'email_taken',
    );
  });
  it('returns one success and one conflict on concurrent registration', async () => {
    const results = await Promise.allSettled(
      [1, 2].map(() =>
        auth.register({
          name: 'Race',
          email: 'race@example.com',
          password: 'entradas123',
        }),
      ),
    );
    expect(
      results.filter((result) => result.status === 'fulfilled'),
    ).toHaveLength(1);
    const rejected = results.find((result) => result.status === 'rejected');
    expect((rejected as PromiseRejectedResult).reason.getStatus()).toBe(409);
  });
  it.each(['organizer', 'doorman'])(
    'forbids privileged public role %s',
    async (role) => {
      await error(
        auth.register({
          name: 'New user',
          email: 'priv@example.com',
          password: 'entradas123',
          role,
        }),
        403,
        'forbidden',
      );
    },
  );
  it.each(['admin', '', null, 42])('rejects unknown role %s', async (role) => {
    await error(
      auth.register({
        name: 'New user',
        email: 'priv@example.com',
        password: 'entradas123',
        role,
      }),
      400,
      'invalid_request',
    );
  });
  it.each(['', 'short'])('rejects weak password %s', async (password) => {
    await error(
      auth.register({ name: 'New user', email: 'weak@example.com', password }),
      400,
      'weak_password',
    );
  });
  it.each([
    null,
    [],
    {},
    { name: 'x', email: 'test@example.com', password: 'entradas123' },
    { name: 'Valid', email: 'invalid', password: 'entradas123' },
  ])('rejects invalid registration body %#', async (body) => {
    await error(auth.register(body), 400, 'invalid_request');
  });
  it('hides whether the account exists', async () => {
    for (const email of ['cliente@entradasya.bo', 'missing@example.com']) {
      await error(
        auth.login({ email, password: 'wrong-pass' }),
        401,
        'invalid_credentials',
      );
    }
  });
  it('does not trim passwords; supports documented NFKC Unicode normalization', async () => {
    await auth.register({
      name: 'Spacing',
      email: 'spaces@example.com',
      password: '  pass1234  ',
    });
    await error(
      auth.login({ email: 'spaces@example.com', password: 'pass1234' }),
      401,
      'invalid_credentials',
    );
    await expect(
      auth.login({ email: 'spaces@example.com', password: '  pass1234  ' }),
    ).resolves.toHaveProperty('token');
    await auth.register({
      name: 'Unicode',
      email: 'unicode@example.com',
      password: 'café12345',
    });
    await expect(
      auth.login({ email: 'unicode@example.com', password: 'cafe\u030112345' }),
    ).resolves.toHaveProperty('token');
  });
  it('keeps repository state safe from returned object mutation', () => {
    const user = users.findByEmail('cliente@entradasya.bo')!;
    user.role = 'organizer';
    expect(users.findByEmail('cliente@entradasya.bo')!.role).toBe('customer');
  });
  it('verifies expiry, signature and algorithm using first-party verifier', async () => {
    const { token } = await auth.login({
      email: 'cliente@entradasya.bo',
      password: 'entradas123',
    });
    await expect(
      new JwtVerifier({
        key: 'another-secret-long-enough-for-hs256-verify',
        algorithms: ['HS256'],
      }).verify(token),
    ).rejects.toThrow();
    await expect(
      new JwtVerifier({
        key: secret,
        algorithms: ['HS256'],
        now: () => Date.now() + 9 * 3600000,
      }).verify(token),
    ).rejects.toThrow();
    const parts = token.split('.');
    parts[0] = Buffer.from(
      JSON.stringify({ alg: 'none', typ: 'JWT' }),
    ).toString('base64url');
    await expect(verifier.verify(parts.join('.'))).rejects.toThrow();
    await expect(
      verifier.verify(new JwtSigner({ key: secret }).sign({ sub: 'x' })),
    ).rejects.toThrow();
  });
});

describe('configuration', () => {
  it('defaults expiry and port, rejects missing secret, invalid port/ttl', () => {
    expect(validateEnvironment({ JWT_SECRET: secret })).toMatchObject({
      PORT: 4001,
      JWT_EXPIRES_IN: '8h',
    });
    for (const invalid of [
      {},
      { JWT_SECRET: 'short' },
      { JWT_SECRET: secret, PORT: 0 },
      { JWT_SECRET: secret, JWT_EXPIRES_IN: '0h' },
    ])
      expect(() => validateEnvironment(invalid)).toThrow();
    expect(expiryMilliseconds('8h')).toBe(28800000);
  });
});
