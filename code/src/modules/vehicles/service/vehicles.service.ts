import { accessibleBy } from '@casl/prisma';
import { ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AuthUser } from 'src/common/interfaces/auth-user.interface';
import { CompanyScopeResolver } from 'src/common/services/company-scope.resolver';
import { AbilityFactory } from 'src/modules/ability/ability.factory';
import { PrismaService } from 'src/prisma/prisma.service';
import { CreateVehicleDto } from '../dtos/create-vehicle.dto';
import { QueryVehicleDto } from '../dtos/query-vehicle.dto';
import { UpdateVehicleDto } from '../dtos/update-vehicle.dto';

const VEHICLE_SELECT = {
  id: true,
  companyId: true,
  plate: true,
  brand: true,
  model: true,
  year: true,
  vehicleType: true,
  isActive: true,
  description: true,
  company: { select: { id: true, name: true } },
  createdAt: true,
  updatedAt: true,
} satisfies Prisma.VehicleSelect;

@Injectable()
export class VehiclesService {
  private readonly logger = new Logger(VehiclesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly abilityFactory: AbilityFactory,
    private readonly companyScopeResolver: CompanyScopeResolver,
  ) {}

  async create(data: CreateVehicleDto, user: AuthUser): Promise<{ id: string; message: string }> {
    const companyId = await this.companyScopeResolver.resolveCompanyId(data, user);

    await this.ensurePlateIsAvailableInCompany(data.plate, companyId);

    const created = await this.prisma.vehicle.create({
      data: {
        ...data,
        companyId,
      },
      select: { id: true },
    });

    this.logger.log(`Vehicle ${created.id} created in company ${companyId}`);

    return { id: created.id, message: 'Veículo criado com sucesso' };
  }

  async findAll(params: QueryVehicleDto, user: AuthUser) {
    const { page, limit, orderBy, order, ...filters } = params;
    const skip = (page - 1) * limit;

    const ability = this.abilityFactory.createForUser(user);
    const where: Prisma.VehicleWhereInput = {
      AND: [
        accessibleBy(ability, 'read').Vehicle,
        { deletedAt: null },
        ...this.buildFilters(filters),
      ],
    };

    const [vehicles, total] = await Promise.all([
      this.prisma.vehicle.findMany({
        where,
        skip,
        take: limit,
        orderBy: { [orderBy]: order },
        select: VEHICLE_SELECT,
      }),
      this.prisma.vehicle.count({ where }),
    ]);

    return {
      data: vehicles,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(id: string, user: AuthUser) {
    const ability = this.abilityFactory.createForUser(user);

    const vehicle = await this.prisma.vehicle.findFirst({
      where: { AND: [{ id, deletedAt: null }, accessibleBy(ability, 'read').Vehicle] },
      select: VEHICLE_SELECT,
    });

    if (!vehicle) {
      throw new NotFoundException(`Veículo com ID ${id} não encontrado`);
    }

    return vehicle;
  }

  async update(
    id: string,
    data: UpdateVehicleDto,
    user: AuthUser,
  ): Promise<{ id: string; message: string }> {
    const vehicle = await this.findOne(id, user);

    if (data.plate && data.plate !== vehicle.plate) {
      await this.ensurePlateIsAvailableInCompany(data.plate, vehicle.companyId, id);
    }

    await this.prisma.vehicle.update({
      where: { id },
      data,
    });

    return { id, message: 'Veículo atualizado com sucesso' };
  }

  async remove(id: string, user: AuthUser): Promise<void> {
    await this.findOne(id, user);

    await this.prisma.vehicle.update({
      where: { id },
      data: { deletedAt: new Date() },
    });
  }

  private async ensurePlateIsAvailableInCompany(
    plate: string,
    companyId: string,
    ignoreId?: string,
  ): Promise<void> {
    const existing = await this.prisma.vehicle.findFirst({
      where: {
        plate,
        companyId,
        deletedAt: null,
        ...(ignoreId && { id: { not: ignoreId } }),
      },
      select: { id: true },
    });

    if (existing) {
      throw new ConflictException('Já existe um veículo cadastrado com esta placa nesta empresa');
    }
  }

  private buildFilters(
    filters: Omit<QueryVehicleDto, 'page' | 'limit' | 'orderBy' | 'order'>,
  ): Prisma.VehicleWhereInput[] {
    const conditions: Prisma.VehicleWhereInput[] = [];

    if (filters.search) {
      conditions.push({
        OR: [
          { plate: { contains: filters.search, mode: 'insensitive' } },
          { brand: { contains: filters.search, mode: 'insensitive' } },
          { model: { contains: filters.search, mode: 'insensitive' } },
        ],
      });
    }

    if (filters.vehicleType) {
      conditions.push({
        vehicleType: Array.isArray(filters.vehicleType)
          ? { in: filters.vehicleType }
          : filters.vehicleType,
      });
    }

    if (filters.isActive !== undefined) {
      conditions.push({ isActive: filters.isActive });
    }

    if (filters.companyId) {
      conditions.push({ companyId: filters.companyId });
    }

    return conditions;
  }
}
