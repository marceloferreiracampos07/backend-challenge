import { ConflictException, NotFoundException } from '@nestjs/common';
import { Role } from 'src/common/enums/role.enum';
import { AuthUser } from 'src/common/interfaces/auth-user.interface';
import { VehiclesService } from './vehicles.service';
import { VehicleType } from '../enums/vehicle-type.enum';

jest.mock('@casl/prisma', () => ({
  accessibleBy: jest.fn(() => ({ Vehicle: {} })),
}));

describe('VehiclesService', () => {
  let service: VehiclesService;
  let prisma: {
    vehicle: {
      create: jest.Mock;
      findFirst: jest.Mock;
      findMany: jest.Mock;
      count: jest.Mock;
      update: jest.Mock;
    };
  };
  let abilityFactory: { createForUser: jest.Mock };
  let companyScopeResolver: { resolveCompanyId: jest.Mock };

  const admin: AuthUser = { id: 'user-admin', role: Role.ADMIN, companyId: null };

  const createDto = {
    plate: 'ABC1234',
    brand: 'Fiat',
    model: 'Strada',
    year: 2022,
    vehicleType: VehicleType.CAR,
    isActive: true,
    description: 'Veículo da frota',
  };

  beforeEach(() => {
    prisma = {
      vehicle: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
    };
    abilityFactory = { createForUser: jest.fn().mockReturnValue({ can: () => true }) };
    companyScopeResolver = { resolveCompanyId: jest.fn().mockResolvedValue('company-1') };

    service = new VehiclesService(prisma as any, abilityFactory as any, companyScopeResolver as any);
  });

  describe('create', () => {
    it('cria o veículo e retorna id e mensagem de sucesso', async () => {
      companyScopeResolver.resolveCompanyId.mockResolvedValue('company-1');
      prisma.vehicle.findFirst.mockResolvedValue(null);
      prisma.vehicle.create.mockResolvedValue({ id: 'vehicle-1' });

      const result = await service.create(createDto as any, admin);

      expect(result).toEqual({ id: 'vehicle-1', message: 'Veículo criado com sucesso' });
      expect(prisma.vehicle.create).toHaveBeenCalledWith({
        data: {
          ...createDto,
          companyId: 'company-1',
        },
        select: { id: true },
      });
    });

    it('lança ConflictException (409) quando já existe veículo não excluído com a mesma placa na empresa', async () => {
      companyScopeResolver.resolveCompanyId.mockResolvedValue('company-1');
      prisma.vehicle.findFirst.mockResolvedValue({ id: 'vehicle-existing' });

      await expect(service.create(createDto as any, admin)).rejects.toBeInstanceOf(ConflictException);
      expect(prisma.vehicle.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ plate: createDto.plate, companyId: 'company-1', deletedAt: null }),
        }),
      );
      expect(prisma.vehicle.create).not.toHaveBeenCalled();
    });
  });

  describe('findOne', () => {
    it('lança NotFoundException (404) quando o veículo não existe ou está fora do escopo', async () => {
      prisma.vehicle.findFirst.mockResolvedValue(null);

      await expect(service.findOne('inexistente', admin)).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('findAll', () => {
    it('retorna os dados com o meta de paginação calculado', async () => {
      const vehicles = [{ id: 'vehicle-1' }, { id: 'vehicle-2' }];
      prisma.vehicle.findMany.mockResolvedValue(vehicles);
      prisma.vehicle.count.mockResolvedValue(15);

      const result = await service.findAll(
        { page: 1, limit: 10, orderBy: 'plate', order: 'asc' },
        admin,
      );

      expect(result).toEqual({
        data: vehicles,
        meta: { total: 15, page: 1, limit: 10, totalPages: 2 },
      });
      expect(prisma.vehicle.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 10, orderBy: { plate: 'asc' } }),
      );
    });
  });

  describe('remove', () => {
    it('faz soft delete preenchendo deletedAt em vez de apagar o registro', async () => {
      prisma.vehicle.findFirst.mockResolvedValue({ id: 'vehicle-1', companyId: 'company-1', plate: 'ABC1234' });

      await service.remove('vehicle-1', admin);

      expect(prisma.vehicle.update).toHaveBeenCalledWith({
        where: { id: 'vehicle-1' },
        data: { deletedAt: expect.any(Date) },
      });
    });
  });
});