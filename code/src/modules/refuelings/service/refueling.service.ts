import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from 'src/prisma/prisma.service';
import { AuthUser } from 'src/common/interfaces/auth-user.interface';
import { AbilityFactory } from 'src/modules/ability/ability.factory';
import { accessibleBy } from '@casl/prisma';
import { CreateRefuelingDto } from '../Dto/create-refueling.dto';
import { ConsumptionQueryDto, QueryRefuelingDto } from '../Dto/query-refueling.dto';

@Injectable()
export class RefuelingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly abilityFactory: AbilityFactory,
  ) {}

  private async findVehicleWithPermission(vehicleId: string, user: AuthUser) {
    const ability = this.abilityFactory.createForUser(user);

    const vehicle = await this.prisma.vehicle.findFirst({
      where: {
        AND: [{ id: vehicleId, deletedAt: null }, accessibleBy(ability, 'read').Vehicle],
      },
      select: { id: true, plate: true, isActive: true, companyId: true },
    });

    if (!vehicle) {
      throw new NotFoundException(`Veículo com ID ${vehicleId} não encontrado`);
    }

    return vehicle;
  }

  async create(vehicleId: string, data: CreateRefuelingDto, user: AuthUser) {
    const vehicle = await this.findVehicleWithPermission(vehicleId, user);

    if (!vehicle.isActive) {
      throw new BadRequestException('Apenas veículos ativos podem receber abastecimentos');
    }

    const newDate = new Date(data.date);

    const history = await this.prisma.refueling.findMany({
      where: { vehicleId },
      orderBy: { date: 'asc' },
    });

    const previousRefueling = [...history].reverse().find(r => new Date(r.date) <= newDate);
    const nextRefueling = history.find(r => new Date(r.date) > newDate);

    if (previousRefueling && data.odometer <= previousRefueling.odometer) {
      throw new BadRequestException(
        `O hodômetro não pode ser menor ou igual ao do abastecimento anterior (${previousRefueling.odometer} km).`,
      );
    }

    if (nextRefueling && data.odometer >= nextRefueling.odometer) {
      throw new BadRequestException(
        `O hodômetro não pode ser maior ou igual ao do abastecimento posterior (${nextRefueling.odometer} km).`,
      );
    }

    const created = await this.prisma.refueling.create({
      data: {
        vehicleId,
        date: newDate,
        liters: data.liters,
        totalValue: data.totalValue,
        odometer: data.odometer,
      },
      select: { id: true },
    });

    return { id: created.id, message: 'Abastecimento registrado com sucesso' };
  }

  async findAll(vehicleId: string, params: QueryRefuelingDto, user: AuthUser) {
    await this.findVehicleWithPermission(vehicleId, user);

    const page = params.page ?? 1;
    const limit = params.limit ?? 10;
    const order = params.order ?? 'desc';
    const skip = (page - 1) * limit;

    const [refuelings, total] = await Promise.all([
      this.prisma.refueling.findMany({
        where: { vehicleId },
        skip,
        take: limit,
        orderBy: { date: order },
      }),
      this.prisma.refueling.count({ where: { vehicleId } }),
    ]);

    return {
      data: refuelings,
      meta: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  async getConsumptionReport(vehicleId: string, query: ConsumptionQueryDto, user: AuthUser) {
    const vehicle = await this.findVehicleWithPermission(vehicleId, user);

    const startDate = new Date(`${query.startDate}T00:00:00.000Z`);
    const endDate = new Date(`${query.endDate}T23:59:59.999Z`);

    const refuelings = await this.prisma.refueling.findMany({
      where: {
        vehicleId,
        date: { gte: startDate, lte: endDate },
      },
      orderBy: { date: 'asc' },
    });

    if (refuelings.length < 2) {
      return {
        vehicleId: vehicle.id,
        plate: vehicle.plate,
        period: { startDate: query.startDate, endDate: query.endDate },
        message:
          'Insuficiência de dados: são necessários pelo menos 2 abastecimentos no período para calcular o consumo.',
        totalKm: 0,
        totalLiters: 0,
        totalSpent: 0,
        averageKmPerLiter: 0,
        averageCostPerKm: 0,
      };
    }

    const first = refuelings[0];
    const last = refuelings[refuelings.length - 1];

    const totalKm = last.odometer - first.odometer;

    const calculationPeriod = refuelings.slice(1);
    const totalLiters = calculationPeriod.reduce((sum, item) => sum + Number(item.liters), 0);
    const totalSpent = calculationPeriod.reduce((sum, item) => sum + Number(item.totalValue), 0);

    const averageKmPerLiter = totalLiters > 0 ? Number((totalKm / totalLiters).toFixed(2)) : 0;
    const averageCostPerKm = totalKm > 0 ? Number((totalSpent / totalKm).toFixed(2)) : 0;

    return {
      vehicleId: vehicle.id,
      plate: vehicle.plate,
      period: {
        startDate: query.startDate,
        endDate: query.endDate,
      },
      totalKm,
      totalLiters: Number(totalLiters.toFixed(2)),
      totalSpent: Number(totalSpent.toFixed(2)),
      averageKmPerLiter,
      averageCostPerKm,
    };
  }
}
