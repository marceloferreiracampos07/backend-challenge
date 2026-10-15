import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { ZodValidationException } from 'nestjs-zod';
import { ZodError } from 'zod';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const body = exception instanceof HttpException ? exception.getResponse() : undefined;
    if (this.isHealthCheckResult(body)) {
      response.status(status).json(body);
      return;
    }

    response.status(status).json({ statusCode: status, message: this.extractMessage(exception) });
  }

  private isHealthCheckResult(body: unknown): body is Record<string, unknown> {
    return typeof body === 'object' && body !== null && 'status' in body && 'details' in body;
  }

  private extractMessage(exception: unknown): string | string[] {
    if (exception instanceof ZodValidationException) {
      const error = exception.getZodError();
      if (error instanceof ZodError) {
        return error.issues.map(issue =>
          issue.path.length ? `${issue.path.join('.')}: ${issue.message}` : issue.message,
        );
      }
    }

    if (!(exception instanceof HttpException)) {
      this.logger.error(exception);
      return 'Erro interno do servidor';
    }

    const response = exception.getResponse();
    if (typeof response === 'string') return response;

    return (response as { message?: string | string[] }).message ?? exception.message;
  }
}
