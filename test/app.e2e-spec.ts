import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { Test } from '@nestjs/testing';
import type { INestApplication } from '@nestjs/common';
import { PasswordHasher, JwtVerifier } from '@nestjs/authentication';
import request from 'supertest';
import { AppModule } from '../src/app.module.js';

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

describe('auth HTTP contract', () => {
  it('GET /health', async () => {
    const result = await request(app.getHttpServer())
      .get('/health')
      .expect(200);
    expect(result.body).toMatchObject({
      service: 'auth',
      status: 'ok',
      storage: 'memory',
    });
  });
  it('registers 201 and logs in 200 with signed token and safe user', async () => {
    const registered = await request(app.getHttpServer())
      .post('/auth/register')
      .send({
        name: 'Ana',
        email: ' ANA@EXAMPLE.COM ',
        password: 'correct-pass',
      })
      .expect(201);
    expect(registered.body.user).toMatchObject({
      name: 'Ana',
      email: 'ana@example.com',
      role: 'customer',
    });
    expect(Object.keys(registered.body.user).sort()).toEqual([
      'email',
      'id',
      'name',
      'role',
    ]);
    const login = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'ana@example.com', password: 'correct-pass' })
      .expect(200);
    const claims = await new JwtVerifier({
      key: process.env.JWT_SECRET!,
      algorithms: ['HS256'],
    }).verify(login.body.token);
    expect(claims.sub).toBe(registered.body.user.id);
    await request(app.getHttpServer())
      .post('/auth/register')
      .send({ name: 'Ana', email: 'ana@example.com', password: 'correct-pass' })
      .expect(409);
  });
  it('forbids public privileged registration and rejects unknown roles', async () => {
    for (const role of ['organizer', 'doorman', 'admin']) {
      const result = await request(app.getHttpServer())
        .post('/auth/register')
        .send({
          name: 'Priv',
          email: 'priv@example.com',
          password: 'correct-pass',
          role,
        })
        .expect(role === 'admin' ? 400 : 403);
      expect(result.body.error.code).toBe(
        role === 'admin' ? 'invalid_request' : 'forbidden',
      );
    }
  });
  it('returns 401 invalid_credentials, not unauthorized on bad login', async () => {
    const result = await request(app.getHttpServer())
      .post('/auth/login')
      .send({ email: 'cliente@entradasya.bo', password: 'bad' })
      .expect(401);
    expect(result.body.error.code).toBe('invalid_credentials');
  });
  it('normalizes parser errors and unknown routes', async () => {
    const invalid = await request(app.getHttpServer())
      .post('/auth/login')
      .set('Content-Type', 'application/json')
      .send('{')
      .expect(400);
    expect(invalid.body.error.code).toBe('invalid_request');
    const missing = await request(app.getHttpServer())
      .get('/missing')
      .expect(404);
    expect(missing.body.error.code).toBe('not_found');
  });
  it('accepts only one concurrent account with the same email', async () => {
    const results = await Promise.all(
      [1, 2].map(() =>
        request(app.getHttpServer()).post('/auth/register').send({
          name: 'Concurrent',
          email: 'concurrent@example.com',
          password: 'correct-pass',
        }),
      ),
    );
    expect(
      results.map((result) => result.status).sort((a, b) => a - b),
    ).toEqual([201, 409]);
  });
});
