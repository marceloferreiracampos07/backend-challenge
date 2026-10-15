import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { ZodValidationPipe } from 'nestjs-zod';
import request from 'supertest';
import { AppModule } from 'src/app.module';
import { PrismaService } from 'src/prisma/prisma.service';
import { VehicleType } from '../enums/vehicle-type.enum';

jest.setTimeout(180000);

const PASSWORD = 'Senha@123';
const prismaCli = join(process.cwd(), 'node_modules', 'prisma', 'build', 'index.js');

const runPrisma = (args: string[], env: NodeJS.ProcessEnv) =>
  execFileSync(process.execPath, [prismaCli, ...args], { env, stdio: 'pipe' });

describe('Vehicles (integração)', () => {
  let container: StartedPostgreSqlContainer;
  let app: INestApplication;
  let prisma: PrismaService;

  let alfaCompanyId: string;
  let betaCompanyId: string;

  let adminToken: string;
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

  const createVehicle = (token: string, payload: Record<string, unknown>) =>
    http().post('/vehicles').set('Authorization', `Bearer ${token}`).send(payload);

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

    const alfa = await prisma.company.findFirstOrThrow({ where: { name: 'Transportes Alfa' } });
    const beta = await prisma.company.findFirstOrThrow({ where: { name: 'Logística Beta' } });
    alfaCompanyId = alfa.id;
    betaCompanyId = beta.id;

    adminToken = await login('admin@motiron.com');
    managerAlfaToken = await login('gestor@transportes-alfa.com');
    managerBetaToken = await login('gestor@logistica-beta.com');
    viewerAlfaToken = await login('visualizacao@transportes-alfa.com');
  });

  afterAll(async () => {
    await app?.close();
    await container?.stop();
  });

  describe('Autenticação e autorização', () => {
    it('rejeita requisição sem token (401)', async () => {
      await http().get('/vehicles').expect(401);
    });

    it('impede o perfil Visualização de criar veículo (403)', async () => {
      await createVehicle(viewerAlfaToken, {
        plate: 'VIS1A11',
        brand: 'Fiat',
        model: 'Uno',
        year: 2020,
        vehicleType: VehicleType.CAR,
      }).expect(403);
    });

    it('impede o perfil Visualização de excluir veículo (403)', async () => {
      const { body } = await createVehicle(managerAlfaToken, {
        plate: 'VIS2B22',
        brand: 'Fiat',
        model: 'Mobi',
        year: 2021,
        vehicleType: VehicleType.CAR,
      }).expect(201);

      await http()
        .delete(`/vehicles/${body.id}`)
        .set('Authorization', `Bearer ${viewerAlfaToken}`)
        .expect(403);
    });
  });

  describe('POST /vehicles', () => {
    it('cria um veículo normalizando a placa e vinculando à empresa do usuário', async () => {
      const { body } = await createVehicle(managerAlfaToken, {
        plate: 'tst-1a23',
        brand: 'Fiat',
        model: 'Toro',
        year: 2024,
        vehicleType: VehicleType.CAR,
        description: 'Veículo de teste',
      }).expect(201);

      expect(body).toEqual({ id: expect.any(String), message: 'Veículo criado com sucesso' });

      const { body: vehicle } = await http()
        .get(`/vehicles/${body.id}`)
        .set('Authorization', `Bearer ${managerAlfaToken}`)
        .expect(200);

      expect(vehicle).toMatchObject({
        id: body.id,
        plate: 'TST1A23',
        companyId: alfaCompanyId,
        brand: 'Fiat',
        model: 'Toro',
        year: 2024,
        vehicleType: VehicleType.CAR,
        isActive: true,
        description: 'Veículo de teste',
      });
    });

    it('retorna 409 quando a placa já existe na empresa', async () => {
      const payload = {
        plate: 'DUP99A1',
        brand: 'Fiat',
        model: 'Argo',
        year: 2023,
        vehicleType: VehicleType.CAR,
      };

      await createVehicle(managerAlfaToken, payload).expect(201);

      const { body } = await createVehicle(managerAlfaToken, payload).expect(409);
      expect(body.message).toBe('Já existe um veículo cadastrado com esta placa nesta empresa');
    });

    it('retorna 400 com mensagem em português quando os dados são inválidos', async () => {
      const { body } = await createVehicle(managerAlfaToken, {
        plate: 'X',
        brand: 'A',
        model: 'B',
        year: 1900,
        vehicleType: 'Invalido',
      }).expect(400);

      expect(Array.isArray(body.message)).toBe(true);
      expect(body.message.length).toBeGreaterThan(0);
    });

    it('exige companyId para o Administrador (400)', async () => {
      const { body } = await createVehicle(adminToken, {
        plate: 'ADM1A11',
        brand: 'Volvo',
        model: 'FH',
        year: 2023,
        vehicleType: VehicleType.TRUCK,
      }).expect(400);

      expect(body.message).toBe('O campo companyId é obrigatório para administradores');
    });

    it('permite o Administrador criar informando uma empresa existente', async () => {
      const { body } = await createVehicle(adminToken, {
        plate: 'ADM2B22',
        brand: 'Scania',
        model: 'R 450',
        year: 2022,
        vehicleType: VehicleType.TRUCK,
        companyId: alfaCompanyId,
      }).expect(201);

      const { body: vehicle } = await http()
        .get(`/vehicles/${body.id}`)
        .set('Authorization', `Bearer ${adminToken}`)
        .expect(200);

      expect(vehicle.companyId).toBe(alfaCompanyId);
    });

    it('retorna 404 quando o Administrador informa uma empresa inexistente', async () => {
      await createVehicle(adminToken, {
        plate: 'ADM3C33',
        brand: 'Ford',
        model: 'Cargo',
        year: 2021,
        vehicleType: VehicleType.TRUCK,
        companyId: 'aaaaaaaaaaaaaaaaaaaaaaaa',
      }).expect(404);
    });
  });

  describe('GET /vehicles', () => {
    it('lista apenas veículos da empresa do usuário com meta de paginação', async () => {
      const { body } = await http()
        .get('/vehicles?page=1&limit=5')
        .set('Authorization', `Bearer ${managerBetaToken}`)
        .expect(200);

      expect(Array.isArray(body.data)).toBe(true);
      expect(body.data.length).toBeLessThanOrEqual(5);
      expect(body.meta).toEqual(
        expect.objectContaining({ page: 1, limit: 5, total: expect.any(Number) }),
      );
      expect(body.data.every((v: { companyId: string }) => v.companyId === betaCompanyId)).toBe(
        true,
      );
    });

    it('filtra por busca (placa, marca ou modelo) ignorando maiúsculas/minúsculas', async () => {
      const { body } = await http()
        .get('/vehicles?search=strada')
        .set('Authorization', `Bearer ${managerAlfaToken}`)
        .expect(200);

      expect(body.data.length).toBeGreaterThan(0);
      expect(body.data.some((v: { model: string }) => v.model.toLowerCase() === 'strada')).toBe(
        true,
      );
    });

    it('filtra por múltiplos tipos de veículo', async () => {
      const { body } = await http()
        .get('/vehicles?vehicleType=Carro&vehicleType=Van')
        .set('Authorization', `Bearer ${managerAlfaToken}`)
        .expect(200);

      expect(body.data.length).toBeGreaterThan(0);
      expect(
        body.data.every((v: { vehicleType: string }) =>
          [VehicleType.CAR, VehicleType.VAN].includes(v.vehicleType as VehicleType),
        ),
      ).toBe(true);
    });
  });

  describe('GET /vehicles/:id', () => {
    it('retorna 404 para veículo inexistente', async () => {
      await http()
        .get('/vehicles/inexistente')
        .set('Authorization', `Bearer ${managerAlfaToken}`)
        .expect(404);
    });

    it('retorna 404 ao acessar veículo de outra empresa', async () => {
      const { body } = await createVehicle(managerAlfaToken, {
        plate: 'CRO1A11',
        brand: 'Fiat',
        model: 'Fiorino',
        year: 2022,
        vehicleType: VehicleType.VAN,
      }).expect(201);

      await http()
        .get(`/vehicles/${body.id}`)
        .set('Authorization', `Bearer ${managerBetaToken}`)
        .expect(404);
    });
  });

  describe('PATCH /vehicles/:id', () => {
    it('atualiza parcialmente o veículo', async () => {
      const { body } = await createVehicle(managerAlfaToken, {
        plate: 'UPD1A11',
        brand: 'Chevrolet',
        model: 'S10',
        year: 2023,
        vehicleType: VehicleType.CAR,
      }).expect(201);

      const { body: updated } = await http()
        .patch(`/vehicles/${body.id}`)
        .set('Authorization', `Bearer ${managerAlfaToken}`)
        .send({ isActive: false, description: 'Em manutenção' })
        .expect(200);

      expect(updated).toEqual({ id: body.id, message: 'Veículo atualizado com sucesso' });

      const { body: vehicle } = await http()
        .get(`/vehicles/${body.id}`)
        .set('Authorization', `Bearer ${managerAlfaToken}`)
        .expect(200);

      expect(vehicle).toMatchObject({ isActive: false, description: 'Em manutenção' });
    });
  });

  describe('DELETE /vehicles/:id', () => {
    it('faz soft delete e remove o veículo dos endpoints', async () => {
      const { body } = await createVehicle(managerAlfaToken, {
        plate: 'DEL9A99',
        brand: 'Toyota',
        model: 'Corolla',
        year: 2024,
        vehicleType: VehicleType.CAR,
      }).expect(201);

      await http()
        .delete(`/vehicles/${body.id}`)
        .set('Authorization', `Bearer ${managerAlfaToken}`)
        .expect(204);

      await http()
        .get(`/vehicles/${body.id}`)
        .set('Authorization', `Bearer ${managerAlfaToken}`)
        .expect(404);

      const stored = await prisma.vehicle.findUnique({ where: { id: body.id } });
      expect(stored?.deletedAt).toBeInstanceOf(Date);
    });

    it('libera a placa para recadastro após o soft delete', async () => {
      const payload = {
        plate: 'REC1A11',
        brand: 'Renault',
        model: 'Kwid',
        year: 2023,
        vehicleType: VehicleType.CAR,
      };

      const { body } = await createVehicle(managerAlfaToken, payload).expect(201);

      await http()
        .delete(`/vehicles/${body.id}`)
        .set('Authorization', `Bearer ${managerAlfaToken}`)
        .expect(204);

      await createVehicle(managerAlfaToken, payload).expect(201);
    });
  });
});
