import { ArgumentsHost, ServiceUnavailableException } from '@nestjs/common';
import { AllExceptionsFilter } from './http-exception.filter';

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;
  let response: { status: jest.Mock; json: jest.Mock };
  let host: ArgumentsHost;

  const healthResult = {
    status: 'error',
    info: {},
    error: { database: { status: 'down' } },
    details: { database: { status: 'down' } },
  };

  beforeEach(() => {
    filter = new AllExceptionsFilter();
    response = { status: jest.fn().mockReturnThis(), json: jest.fn() };
    host = {
      switchToHttp: () => ({ getResponse: <T>() => response as unknown as T }),
    } as unknown as ArgumentsHost;
  });

  it('preserva o corpo do health check do terminus sem reescrever', () => {
    filter.catch(new ServiceUnavailableException(healthResult), host);

    expect(response.status).toHaveBeenCalledWith(503);
    expect(response.json).toHaveBeenCalledWith(healthResult);
  });

  it('mantém o formato padrão para os demais erros', () => {
    filter.catch(new ServiceUnavailableException('indisponível'), host);

    expect(response.status).toHaveBeenCalledWith(503);
    expect(response.json).toHaveBeenCalledWith({ statusCode: 503, message: 'indisponível' });
  });
});
