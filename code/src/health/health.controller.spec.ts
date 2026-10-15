import { HealthCheckService, PrismaHealthIndicator } from '@nestjs/terminus';
import { PrismaService } from '../prisma/prisma.service';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;
  let health: { check: jest.Mock };
  let prismaHealth: { pingCheck: jest.Mock };
  let prisma: PrismaService;

  const healthResult = {
    status: 'ok',
    info: { database: { status: 'up' } },
    error: {},
    details: { database: { status: 'up' } },
  };

  beforeEach(() => {
    health = { check: jest.fn().mockResolvedValue(healthResult) };
    prismaHealth = { pingCheck: jest.fn().mockReturnValue('attempt') };
    prisma = {} as PrismaService;

    controller = new HealthController(
      health as unknown as HealthCheckService,
      prismaHealth as unknown as PrismaHealthIndicator,
      prisma,
    );
  });

  it('retorna o resultado do health check', async () => {
    await expect(controller.check()).resolves.toEqual(healthResult);

    expect(health.check).toHaveBeenCalledTimes(1);
  });

  it('registra um único indicador que faz ping no banco via Prisma', async () => {
    controller.check();

    const [indicators] = health.check.mock.calls[0];
    expect(indicators).toHaveLength(1);

    await indicators[0]();
    expect(prismaHealth.pingCheck).toHaveBeenCalledWith('database', prisma);
  });
});
