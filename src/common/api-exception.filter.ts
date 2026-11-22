import { Catch, HttpException, Logger } from '@nestjs/common';
import type { ArgumentsHost, ExceptionFilter } from '@nestjs/common';
import type { Response } from 'express';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const status =
      exception instanceof HttpException ? exception.getStatus() : 500;
    const body =
      exception instanceof HttpException ? exception.getResponse() : null;
    if (
      body &&
      typeof body === 'object' &&
      'error' in body &&
      body.error !== null &&
      typeof body.error === 'object' &&
      'code' in body.error &&
      'message' in body.error
    ) {
      response.status(status).json(body);
      return;
    }
    // Do not log request bodies, credentials, tokens or raw exception messages.
    if (status >= 500)
      this.logger.error('Fallo interno al procesar la solicitud.');
    response.status(status).json({
      error: {
        code:
          status === 404
            ? 'not_found'
            : status >= 500
              ? 'internal_error'
              : 'invalid_request',
        message:
          status === 404
            ? 'No encontramos el recurso.'
            : status >= 500
              ? 'No pudimos procesar la solicitud.'
              : 'La solicitud no es válida.',
      },
    });
  }
}
