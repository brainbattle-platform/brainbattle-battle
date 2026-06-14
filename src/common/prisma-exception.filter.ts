import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpStatus,
} from '@nestjs/common';
import {
  PrismaClientKnownRequestError,
  PrismaClientUnknownRequestError,
} from '@prisma/client/runtime/library';

function isDbUnavailable(message: string) {
  const lower = message.toLowerCase();
  return (
    lower.includes("can't reach database server") ||
    lower.includes('max clients reached') ||
    lower.includes('emaxconnsession') ||
    lower.includes('timed out fetching a new connection') ||
    lower.includes('unable to start a transaction')
  );
}

@Catch(PrismaClientKnownRequestError, PrismaClientUnknownRequestError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: PrismaClientKnownRequestError | PrismaClientUnknownRequestError, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse();
    const request = ctx.getRequest();
    const message = exception.message || '';
    const code = 'code' in exception ? exception.code : undefined;

    if (code === 'P1001' || code === 'P2024' || code === 'P2028' || isDbUnavailable(message)) {
      return response.status(HttpStatus.SERVICE_UNAVAILABLE).json({
        statusCode: HttpStatus.SERVICE_UNAVAILABLE,
        error: 'Battle database temporarily unavailable',
        message: 'Battle server is online, but the PostgreSQL/Supabase connection is saturated or unreachable. Retry after a few seconds or check DATABASE_URL pooler mode.',
        path: request.url,
      });
    }

    return response.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'Battle database error',
      message: 'A database error occurred while processing the battle request.',
      path: request.url,
    });
  }
}
