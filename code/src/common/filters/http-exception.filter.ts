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
    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    host
      .switchToHttp()
      .getResponse<Response>()
      .status(status)
      .json({ statusCode: status, message: this.extractMessage(exception) });
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
