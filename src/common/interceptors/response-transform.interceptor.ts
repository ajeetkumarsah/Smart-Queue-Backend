import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';

export interface StandardResponse<T = any> {
  status: boolean;
  message: string;
  messageType: 'toast' | 'popup' | 'none';
  data: T | null;
  error: string | null;
}

@Injectable()
export class ResponseTransformInterceptor<T>
  implements NestInterceptor<T, StandardResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<StandardResponse<T>> {
    const request = context.switchToHttp().getRequest();
    const method: string = request.method?.toUpperCase() ?? 'GET';

    // Default messageType based on HTTP method
    const defaultMessageType: 'toast' | 'popup' | 'none' =
      method === 'GET' ? 'none' : 'toast';

    return next.handle().pipe(
      map((responseData: any) => {
        // If the controller already returned the standard envelope, pass through
        if (
          responseData &&
          typeof responseData === 'object' &&
          typeof responseData.status === 'boolean' &&
          'message' in responseData
        ) {
          return {
            status: responseData.status,
            message: responseData.message ?? 'Success',
            messageType:
              responseData.messageType ?? defaultMessageType,
            data: responseData.data ?? null,
            error: responseData.error ?? null,
          };
        }

        // If the controller returned { data, message } without status
        if (
          responseData &&
          typeof responseData === 'object' &&
          'data' in responseData
        ) {
          return {
            status: true,
            message: responseData.message ?? 'Success',
            messageType:
              responseData.messageType ?? defaultMessageType,
            data: responseData.data,
            error: null,
          };
        }

        // If the controller returned raw data (array, primitive, etc.)
        return {
          status: true,
          message: 'Success',
          messageType: defaultMessageType,
          data: responseData ?? null,
          error: null,
        };
      }),
    );
  }
}
