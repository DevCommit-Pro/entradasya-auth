import { HttpException } from '@nestjs/common';

export function apiError(status: number, code: string, message: string): never {
  throw new HttpException({ error: { code, message } }, status);
}
