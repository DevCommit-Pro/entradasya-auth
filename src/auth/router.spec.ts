import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { PasswordHasher, JwtVerifier } from '@nestjs/authentication';
import { AppModule } from '../app.module.js';
import { inject } from '../../test/inject.js';

let app: INestApplication;
beforeAll(async () => {
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(PasswordHasher)
    .useValue(new PasswordHasher({ logN: 10 }))
    .compile();
  app = module.createNestApplication();
  app.useLogger(false);
  await app.init();
});
afterAll(async () => {
  await app?.close();
});

describe('Express router contract — in-memory streams, no network listener', () => {
  it('health and not_found envelope', async () => {
    expect(await inject(app, 'GET', '/health')).toMatchObject({
      status: 200,
      body: { status: 'ok', storage: 'memory' },
    });
    expect(await inject(app, 'GET', '/missing')).toMatchObject({
      status: 404,
      body: { error: { code: 'not_found' } },
    });
  });
  it('register/login exact statuses and JWT', async () => {
    const result = await inject(app, 'POST', '/auth/register', {
      name: 'Router',
      email: 'router@example.com',
      password: 'password123',
    });
    expect(result.status).toBe(201);
    expect(result.body.user.role).toBe('customer');
    const loggedIn = await inject(app, 'POST', '/auth/login', {
      email: 'router@example.com',
      password: 'password123',
    });
    expect(loggedIn.status).toBe(200);
    const claims = await new JwtVerifier({
      key: process.env.JWT_SECRET!,
      algorithms: ['HS256'],
    }).verify(loggedIn.body.token);
    expect(claims.sub).toBe(result.body.user.id);
    expect(
      await inject(app, 'POST', '/auth/register', {
        name: 'Router',
        email: 'ROUTER@example.com',
        password: 'password123',
      }),
    ).toMatchObject({ status: 409, body: { error: { code: 'email_taken' } } });
  });
  it('rejects privileged roles, weak passwords and incorrect login', async () => {
    expect(
      await inject(app, 'POST', '/auth/register', {
        name: 'Router',
        email: 'priv@example.com',
        password: 'password123',
        role: 'organizer',
      }),
    ).toMatchObject({ status: 403, body: { error: { code: 'forbidden' } } });
    expect(
      await inject(app, 'POST', '/auth/register', {
        name: 'Router',
        email: 'weak@example.com',
        password: '',
      }),
    ).toMatchObject({
      status: 400,
      body: { error: { code: 'weak_password' } },
    });
    expect(
      await inject(app, 'POST', '/auth/login', {
        email: 'cliente@entradasya.bo',
        password: 'wrong',
      }),
    ).toMatchObject({
      status: 401,
      body: { error: { code: 'invalid_credentials' } },
    });
  });
  it('handles invalid JSON in the global exception filter', async () => {
    expect(
      await inject(app, 'POST', '/auth/login', undefined, '{'),
    ).toMatchObject({
      status: 400,
      body: { error: { code: 'invalid_request' } },
    });
  });
});
