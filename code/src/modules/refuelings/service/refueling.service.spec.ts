import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Role } from 'src/common/enums/role.enum';
import { AuthUser } from 'src/common/interfaces/auth-user.interface';
import { RefuelingsService } from 'src/modules/refuelings/service/refueling.service';

jest.mock('@casl/prisma', () => ({
  accessibleBy: jest.fn(() => ({ Vehicle: {} })),
}));

describe('RefuelingsService', () => {
  let service: RefuelingsService;
  let prisma: {
    vehicle: {
      findFirst: jest.Mock;
    };
    refueling: {
      findMany: jest.Mock;
      create: jest.Mock;
      count: jest.Mock;
    };
  };
  let abilityFactory: { createForUser: jest.Mock };

  const admin: AuthUser = { id: 'user-admin', role: Role.ADMIN, companyId: null };

  const mockVehicle = {
    id: 'vehicle-1',
    plate: 'ABC1234',
    isActive: true,
    companyId: 'company-1',
  };

  const createDto = {
    date: new Date('2026-06-05T10:00:00.000Z'),
    liters: 50,
    totalValue: 300,
    odometer: 1500,
  };

  beforeEach(() => {
    prisma = {
      vehicle: {
        findFirst: jest.fn(),
      },
      refueling: {
        findMany: jest.fn(),
        create: jest.fn(),
        count: jest.fn(),
      },
    };
    abilityFactory = { createForUser: jest.fn().mockReturnValue({ can: () => true }) };

    service = new RefuelingsService(prisma as any, abilityFactory);
  });

  describe('findVehicleWithPermission', () => {
    it('lança NotFoundException (404) se o veículo não for encontrado ou estiver sem permissão', async () => {
      prisma.vehicle.findFirst.mockResolvedValue(null);

      await expect(
        service.create('vehicle-inexistent', createDto as any, admin),
      ).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('create', () => {
    it('registra o abastecimento com sucesso em um veículo ativo', async () => {
      prisma.vehicle.findFirst.mockResolvedValue(mockVehicle);
      prisma.refueling.findMany.mockResolvedValue([]);
      prisma.refueling.create.mockResolvedValue({ id: 'ref-1' });

      const result = await service.create('vehicle-1', createDto, admin);

      expect(result).toEqual({ id: 'ref-1', message: 'Abastecimento registrado com sucesso' });
      expect(prisma.refueling.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ vehicleId: 'vehicle-1', odometer: 1500 }),
        }),
      );
    });

    it('lança BadRequestException se o veículo estiver inativo', async () => {
      prisma.vehicle.findFirst.mockResolvedValue({ ...mockVehicle, isActive: false });

      await expect(service.create('vehicle-1', createDto as any, admin)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('lança BadRequestException se o hodômetro for menor ou igual ao abastecimento anterior', async () => {
      prisma.vehicle.findFirst.mockResolvedValue(mockVehicle);
      prisma.refueling.findMany.mockResolvedValue([
        { id: 'ref-old', date: new Date('2026-06-01'), odometer: 1600 },
      ]);

      await expect(service.create('vehicle-1', createDto as any, admin)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('lança BadRequestException se o hodômetro for maior ou igual ao abastecimento posterior (lançamento no meio)', async () => {
      prisma.vehicle.findFirst.mockResolvedValue(mockVehicle);
      prisma.refueling.findMany.mockResolvedValue([
        { id: 'ref-future', date: new Date('2026-06-10'), odometer: 1400 },
      ]);

      await expect(service.create('vehicle-1', createDto as any, admin)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('cria o primeiro abastecimento quando o veículo não tem histórico', async () => {
      prisma.vehicle.findFirst.mockResolvedValue(mockVehicle);
      prisma.refueling.findMany.mockResolvedValue([]);
      prisma.refueling.create.mockResolvedValue({ id: 'ref-1' });

      await expect(service.create('vehicle-1', createDto as any, admin)).resolves.toEqual({
        id: 'ref-1',
        message: 'Abastecimento registrado com sucesso',
      });
    });

    it('permite lançamento "no meio" quando o hodômetro fica entre o anterior e o posterior', async () => {
      prisma.vehicle.findFirst.mockResolvedValue(mockVehicle);
      prisma.refueling.findMany.mockResolvedValue([
        { id: 'ref-old', date: new Date('2026-06-01'), odometer: 1000 },
        { id: 'ref-new', date: new Date('2026-06-20'), odometer: 1400 },
      ]);
      prisma.refueling.create.mockResolvedValue({ id: 'ref-middle' });

      const result = await service.create(
        'vehicle-1',
        { ...createDto, date: new Date('2026-06-10'), odometer: 1200 },
        admin,
      );

      expect(result.id).toBe('ref-middle');
      expect(prisma.refueling.create).toHaveBeenCalledTimes(1);
    });
  });

  describe('findAll', () => {
    it('retorna a lista paginada de abastecimentos ordenada corretamente', async () => {
      prisma.vehicle.findFirst.mockResolvedValue(mockVehicle);
      prisma.refueling.findMany.mockResolvedValue([{ id: 'ref-1' }]);
      prisma.refueling.count.mockResolvedValue(1);

      const result = await service.findAll(
        'vehicle-1',
        { page: 1, limit: 10, order: 'desc' },
        admin,
      );

      expect(result).toEqual({
        data: [{ id: 'ref-1' }],
        meta: { total: 1, page: 1, limit: 10, totalPages: 1 },
      });
      expect(prisma.refueling.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ orderBy: { date: 'desc' } }),
      );
    });

    it('usa paginação padrão (page 1, limit 10, ordem desc) quando não informada', async () => {
      prisma.vehicle.findFirst.mockResolvedValue(mockVehicle);
      prisma.refueling.findMany.mockResolvedValue([]);
      prisma.refueling.count.mockResolvedValue(0);

      const result = await service.findAll('vehicle-1', {} as any, admin);

      expect(result.meta).toEqual({ total: 0, page: 1, limit: 10, totalPages: 0 });
      expect(prisma.refueling.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 10, orderBy: { date: 'desc' } }),
      );
    });

    it('ordena de forma ascendente quando solicitado', async () => {
      prisma.vehicle.findFirst.mockResolvedValue(mockVehicle);
      prisma.refueling.findMany.mockResolvedValue([]);
      prisma.refueling.count.mockResolvedValue(0);

      await service.findAll('vehicle-1', { page: 1, limit: 5, order: 'asc' } as any, admin);

      expect(prisma.refueling.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 5, orderBy: { date: 'asc' } }),
      );
    });
  });

  describe('getConsumptionReport', () => {
    it('retorna mensagem de insuficiência de dados quando há menos de 2 abastecimentos no período', async () => {
      prisma.vehicle.findFirst.mockResolvedValue(mockVehicle);
      prisma.refueling.findMany.mockResolvedValue([
        { id: 'ref-1', odometer: 1000, liters: 40, totalValue: 200 },
      ]);

      const result = await service.getConsumptionReport(
        'vehicle-1',
        { startDate: '2026-06-01', endDate: '2026-06-30' },
        admin,
      );

      expect(result).toHaveProperty('message');
      expect(result.totalKm).toBe(0);
    });

    it('calcula corretamente o relatório de consumo com 2 ou mais abastecimentos', async () => {
      prisma.vehicle.findFirst.mockResolvedValue(mockVehicle);
      prisma.refueling.findMany.mockResolvedValue([
        { id: 'ref-1', date: new Date('2026-06-01'), odometer: 1000, liters: 0, totalValue: 0 },
        { id: 'ref-2', date: new Date('2026-06-15'), odometer: 1200, liters: 20, totalValue: 120 },
      ]);

      const result = await service.getConsumptionReport(
        'vehicle-1',
        { startDate: '2026-06-01', endDate: '2026-06-30' },
        admin,
      );

      expect(result).toEqual({
        vehicleId: 'vehicle-1',
        plate: 'ABC1234',
        period: { startDate: '2026-06-01', endDate: '2026-06-30' },
        totalKm: 200,
        totalLiters: 20,
        totalSpent: 120,
        averageKmPerLiter: 10,
        averageCostPerKm: 0.6,
      });
    });

    it('lança NotFoundException (404) quando o veículo não existe ou está fora do escopo', async () => {
      prisma.vehicle.findFirst.mockResolvedValue(null);

      await expect(
        service.getConsumptionReport(
          'vehicle-inexistente',
          { startDate: '2026-06-01', endDate: '2026-06-30' },
          admin,
        ),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('não divide por zero e devolve averageKmPerLiter 0 quando não há litros', async () => {
      prisma.vehicle.findFirst.mockResolvedValue(mockVehicle);
      prisma.refueling.findMany.mockResolvedValue([
        { id: 'ref-1', date: new Date('2026-06-01'), odometer: 1000, liters: 0, totalValue: 0 },
        { id: 'ref-2', date: new Date('2026-06-15'), odometer: 1200, liters: 0, totalValue: 100 },
      ]);

      const result = await service.getConsumptionReport(
        'vehicle-1',
        { startDate: '2026-06-01', endDate: '2026-06-30' },
        admin,
      );

      expect(result.totalKm).toBe(200);
      expect(result.totalLiters).toBe(0);
      expect(result.averageKmPerLiter).toBe(0);
      expect(result.averageCostPerKm).toBe(0.5);
    });
  });
});
