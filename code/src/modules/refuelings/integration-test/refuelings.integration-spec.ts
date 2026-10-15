import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { ZodValidationPipe } from 'nestjs-zod';
import request from 'supertest';
import { AppModule } from 'src/app.module';
import { PrismaService } from 'src/prisma/prisma.service';
import { VehicleType } from 'src/modules/vehicles/enums/vehicle-type.enum';

jest.setTimeout(180000);

const PASSWORD = 'Senha@123';
const prismaCli = join(process.cwd(), 'node_modules', 'prisma', 'build', 'index.js');

const runPrisma = (args: string[], env: NodeJS.ProcessEnv) =>
  execFileSync(process.execPath, [prismaCli, ...args], { env, stdio: 'pipe' });

describe('Refuelings (integração)', () => {
  let container: StartedPostgreSqlContainer;
  let app: INestApplication;
  let prisma: PrismaService;

  let activeVehicleId: string;
  let inactiveVehicleId: string;

  let managerAlfaToken: string;
  let managerBetaToken: string;
  let viewerAlfaToken: string;

  const http = () => request(app.getHttpServer());

  const login = async (email: string): Promise<string> => {
    const { body } = await http()
      .post('/auth/login')
      .send({ email, password: PASSWORD })
      .expect(200);
    return body.accessToken as string;
  };

  const addRefueling = (token: string, vehicleId: string, payload: Record<string, unknown>) =>
    http()
      .post(`/vehicles/${vehicleId}/refuelings`)
      .set('Authorization', `Bearer ${token}`)
      .send(payload);

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:17-alpine')
      .withDatabase('fleet_test')
      .withUsername('postgres')
      .withPassword('postgres')
      .start();

    process.env.DATABASE_URL = `${container.getConnectionUri()}?schema=public`;
    process.env.JWT_SECRET = 'test-jwt-secret-with-at-least-32-characters-long';

    const env = { ...process.env };
    runPrisma(['migrate', 'deploy'], env);
    runPrisma(['db', 'seed'], env);

    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(new ZodValidationPipe());
    await app.init();

    prisma = app.get(PrismaService);

    managerAlfaToken = await login('gestor@transportes-alfa.com');
    managerBetaToken = await login('gestor@logistica-beta.com');
    viewerAlfaToken = await login('visualizacao@transportes-alfa.com');

    const { body: created } = await http()
      .post('/vehicles')
      .set('Authorization', `Bearer ${managerAlfaToken}`)
      .send({
        plate: 'RFU1A11',
        brand: 'Fiat',
        model: 'Fiorino',
        year: 2023,
        vehicleType: VehicleType.VAN,
      })
      .expect(201);
    activeVehicleId = created.id;

    const inactive = await prisma.vehicle.findFirstOrThrow({ where: { plate: 'SPR3C33' } });
    inactiveVehicleId = inactive.id;
  });

  afterAll(async () => {
    await app?.close();
    await container?.stop();
  });

  beforeEach(async () => {
    await prisma.refueling.deleteMany({ where: { vehicleId: activeVehicleId } });
  });

  describe('Autenticação e autorização', () => {
    it('rejeita requisição sem token (401)', async () => {
      await http().get(`/vehicles/${activeVehicleId}/refuelings`).expect(401);
    });

    it('impede o perfil Visualização de registrar abastecimento (403)', async () => {
      await addRefueling(viewerAlfaToken, activeVehicleId, {
        date: '2026-06-01T10:00:00.000Z',
        liters: 40,
        totalValue: 200,
        odometer: 1000,
      }).expect(403);
    });
  });

  describe('POST /vehicles/:id/refuelings', () => {
    it('registra um abastecimento em um veículo ativo', async () => {
      const { body } = await addRefueling(managerAlfaToken, activeVehicleId, {
        date: '2026-06-01T10:00:00.000Z',
        liters: 40.5,
        totalValue: 250,
        odometer: 1000,
      }).expect(201);

      expect(body).toEqual({
        id: expect.any(String),
        message: 'Abastecimento registrado com sucesso',
      });
    });

    it('retorna 400 quando litros/valor não são positivos', async () => {
      const { body } = await addRefueling(managerAlfaToken, activeVehicleId, {
        date: '2026-06-01T10:00:00.000Z',
        liters: 0,
        totalValue: 0,
        odometer: 1000,
      }).expect(400);

      expect(Array.isArray(body.message)).toBe(true);
    });

    it('retorna 400 ao abastecer um veículo inativo', async () => {
      const { body } = await addRefueling(managerAlfaToken, inactiveVehicleId, {
        date: '2026-06-01T10:00:00.000Z',
        liters: 40,
        totalValue: 200,
        odometer: 1000,
      }).expect(400);

      expect(body.message).toBe('Apenas veículos ativos podem receber abastecimentos');
    });

    it('retorna 404 ao acessar veículo de outra empresa', async () => {
      await addRefueling(managerBetaToken, activeVehicleId, {
        date: '2026-06-01T10:00:00.000Z',
        liters: 40,
        totalValue: 200,
        odometer: 1000,
      }).expect(404);
    });

    it('retorna 404 quando o veículo não existe', async () => {
      await addRefueling(managerAlfaToken, 'inexistente', {
        date: '2026-06-01T10:00:00.000Z',
        liters: 40,
        totalValue: 200,
        odometer: 1000,
      }).expect(404);
    });

    it('retorna 400 quando o hodômetro é menor ou igual ao do abastecimento anterior', async () => {
      await addRefueling(managerAlfaToken, activeVehicleId, {
        date: '2026-06-01T10:00:00.000Z',
        liters: 40,
        totalValue: 200,
        odometer: 1000,
      }).expect(201);

      await addRefueling(managerAlfaToken, activeVehicleId, {
        date: '2026-06-10T10:00:00.000Z',
        liters: 30,
        totalValue: 150,
        odometer: 900,
      }).expect(400);
    });

    it('retorna 400 ao lançar no meio com hodômetro maior ou igual ao posterior', async () => {
      await addRefueling(managerAlfaToken, activeVehicleId, {
        date: '2026-06-01T10:00:00.000Z',
        liters: 40,
        totalValue: 200,
        odometer: 1000,
      }).expect(201);

      await addRefueling(managerAlfaToken, activeVehicleId, {
        date: '2026-06-20T10:00:00.000Z',
        liters: 40,
        totalValue: 200,
        odometer: 1400,
      }).expect(201);

      await addRefueling(managerAlfaToken, activeVehicleId, {
        date: '2026-06-10T10:00:00.000Z',
        liters: 30,
        totalValue: 150,
        odometer: 1500,
      }).expect(400);
    });

    it('aceita lançamento "no meio" com hodômetro dentro do intervalo', async () => {
      await addRefueling(managerAlfaToken, activeVehicleId, {
        date: '2026-06-01T10:00:00.000Z',
        liters: 40,
        totalValue: 200,
        odometer: 1000,
      }).expect(201);

      await addRefueling(managerAlfaToken, activeVehicleId, {
        date: '2026-06-20T10:00:00.000Z',
        liters: 40,
        totalValue: 200,
        odometer: 1400,
      }).expect(201);

      await addRefueling(managerAlfaToken, activeVehicleId, {
        date: '2026-06-10T10:00:00.000Z',
        liters: 30,
        totalValue: 150,
        odometer: 1200,
      }).expect(201);

      const count = await prisma.refueling.count({ where: { vehicleId: activeVehicleId } });
      expect(count).toBe(3);
    });
  });

  describe('GET /vehicles/:id/refuelings', () => {
    it('lista os abastecimentos do veículo de forma paginada e ordenada', async () => {
      for (const [date, odometer] of [
        ['2026-06-01T10:00:00.000Z', 1000],
        ['2026-06-10T10:00:00.000Z', 1200],
        ['2026-06-20T10:00:00.000Z', 1500],
      ] as const) {
        await addRefueling(managerAlfaToken, activeVehicleId, {
          date,
          liters: 40,
          totalValue: 200,
          odometer,
        }).expect(201);
      }

      const { body } = await http()
        .get(`/vehicles/${activeVehicleId}/refuelings?page=1&limit=2&order=asc`)
        .set('Authorization', `Bearer ${managerAlfaToken}`)
        .expect(200);

      expect(body.data).toHaveLength(2);
      expect(body.meta).toEqual({ total: 3, page: 1, limit: 2, totalPages: 2 });
      expect(new Date(body.data[0].date).getTime()).toBeLessThan(
        new Date(body.data[1].date).getTime(),
      );
    });

    it('retorna 404 para veículo de outra empresa', async () => {
      await http()
        .get(`/vehicles/${activeVehicleId}/refuelings`)
        .set('Authorization', `Bearer ${managerBetaToken}`)
        .expect(404);
    });
  });

  describe('GET /vehicles/:id/consumption', () => {
    it('informa insuficiência de dados com menos de 2 abastecimentos no período', async () => {
      await addRefueling(managerAlfaToken, activeVehicleId, {
        date: '2026-06-01T10:00:00.000Z',
        liters: 40,
        totalValue: 200,
        odometer: 1000,
      }).expect(201);

      const { body } = await http()
        .get(`/vehicles/${activeVehicleId}/consumption?startDate=2026-06-01&endDate=2026-06-30`)
        .set('Authorization', `Bearer ${managerAlfaToken}`)
        .expect(200);

      expect(body.message).toContain('Insuficiência de dados');
      expect(body.totalKm).toBe(0);
      expect(body.averageKmPerLiter).toBe(0);
    });

    it('calcula o relatório de consumo do período', async () => {
      const entries = [
        ['2026-06-01T10:00:00.000Z', 1000, 40, 200],
        ['2026-06-10T10:00:00.000Z', 1200, 20, 120],
        ['2026-06-20T10:00:00.000Z', 1500, 30, 180],
      ] as const;

      for (const [date, odometer, liters, totalValue] of entries) {
        await addRefueling(managerAlfaToken, activeVehicleId, {
          date,
          liters,
          totalValue,
          odometer,
        }).expect(201);
      }

      const { body } = await http()
        .get(`/vehicles/${activeVehicleId}/consumption?startDate=2026-06-01&endDate=2026-06-30`)
        .set('Authorization', `Bearer ${managerAlfaToken}`)
        .expect(200);

      expect(body).toMatchObject({
        vehicleId: activeVehicleId,
        period: { startDate: '2026-06-01', endDate: '2026-06-30' },
        totalKm: 500,
        totalLiters: 50,
        totalSpent: 300,
        averageKmPerLiter: 10,
        averageCostPerKm: 0.6,
      });
    });

    it('valida o formato das datas (400)', async () => {
      await http()
        .get(`/vehicles/${activeVehicleId}/consumption?startDate=01-06-2026&endDate=2026-06-30`)
        .set('Authorization', `Bearer ${managerAlfaToken}`)
        .expect(400);
    });
  });
});
