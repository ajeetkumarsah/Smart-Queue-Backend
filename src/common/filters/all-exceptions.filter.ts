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

    const message =
      exception instanceof HttpException
        ? (exceptionResponse as any)?.message || exception.message
        : (exception as any)?.message || 'Internal server error';

    // Log the error with stack trace
    this.logger.error(
      `HTTP Status: ${String(httpStatus)} Error Message: ${JSON.stringify(message)} on ${String(request.method)} ${String(request.url)}`,
      (exception as any)?.stack,
    );

    const responseBody = {
      statusCode: httpStatus,
      message: message,
      error:
        (exceptionResponse as any)?.error ||
        (httpStatus === HttpStatus.INTERNAL_SERVER_ERROR
          ? 'Internal Server Error'
          : undefined),
      timestamp: new Date().toISOString(),
      path: String(request.url),
    };

    response.status(httpStatus).json(responseBody);
  }
}
