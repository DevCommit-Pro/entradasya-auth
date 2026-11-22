// Test-only Express dispatch through Node request/response streams; no listening socket.
// This exercises routing/body parsing/filters, but is not a live-network HTTP test.
import { IncomingMessage, ServerResponse } from 'node:http';
import { Duplex } from 'node:stream';
import type { Socket } from 'node:net';
import type { INestApplication } from '@nestjs/common';

export async function inject(
  app: INestApplication,
  method: string,
  path: string,
  body?: unknown,
  raw?: string,
) {
  const payload = raw ?? (body === undefined ? '' : JSON.stringify(body));
  const chunks: Buffer[] = [];
  const socket = new Duplex({
    read() {},
    write(chunk: Buffer, _encoding, done) {
      chunks.push(Buffer.from(chunk));
      done();
    },
  });
  const req = new IncomingMessage(socket as Socket);
  req.method = method;
  req.url = path;
  req.headers = {
    host: 'localhost',
    ...(payload
      ? {
          'content-type': 'application/json',
          'content-length': String(Buffer.byteLength(payload)),
        }
      : {}),
  };
  const res = new ServerResponse(req);
  res.assignSocket(socket as Socket);
  return await new Promise<{ status: number; body: any }>((resolve, reject) => {
    const timeout = setTimeout(() => {
      socket.destroy();
      reject(new Error('In-memory router timed out'));
    }, 5000);
    res.on('finish', () => {
      clearTimeout(timeout);
      const serialized = Buffer.concat(chunks).toString();
      const content = serialized.slice(serialized.indexOf('\r\n\r\n') + 4);
      try {
        resolve({
          status: res.statusCode,
          body: content ? JSON.parse(content) : null,
        });
      } catch (error) {
        reject(error);
      } finally {
        socket.destroy();
      }
    });
    app.getHttpAdapter().getInstance()(req, res);
    if (payload) req.push(payload);
    req.complete = true;
    req.push(null);
  });
}
