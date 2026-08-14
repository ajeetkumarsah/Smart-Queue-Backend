/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-enum-comparison, @typescript-eslint/no-unsafe-call */
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';

@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  private readonly logger = new Logger(AllExceptionsFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response: any = ctx.getResponse();
    const request: any = ctx.getRequest();

    const httpStatus =
      exception instanceof HttpException
        ? exception.getStatus()
        : HttpStatus.INTERNAL_SERVER_ERROR;

    const exceptionResponse =
      exception instanceof HttpException ? exception.getResponse() : null;

    // Extract message — handle array messages from class-validator
    let message: string;
    if (exception instanceof HttpException) {
      const raw = (exceptionResponse as any)?.message;
      if (Array.isArray(raw)) {
        message = raw.join(', ');
      } else {
        message = raw?.toString() || exception.message;
      }
    } else {
      message = (exception as any)?.message || 'Internal server error';
    }

    // Determine messageType based on HTTP status
    let messageType: 'toast' | 'popup' | 'none' = 'toast';
    if (httpStatus === HttpStatus.UNAUTHORIZED) {
      messageType = 'none'; // handled by token refresh logic
    } else if (httpStatus === HttpStatus.FORBIDDEN) {
      messageType = 'popup'; // critical: access denied, plan expired
    }

    // Determine error label
    const errorLabel =
      (exceptionResponse as any)?.error ||
      (httpStatus >= 500 ? 'Internal Server Error' : 'Bad Request');

    // Log the error with stack trace
    this.logger.error(
      `HTTP ${String(httpStatus)}: ${JSON.stringify(message)} — ${String(request.method)} ${String(request.url)}`,
      (exception as any)?.stack,
    );

    const responseBody = {
      status: false,
      message,
      messageType,
      data: null,
      error: errorLabel,
    };

    response.status(httpStatus).json(responseBody);
  }
}
