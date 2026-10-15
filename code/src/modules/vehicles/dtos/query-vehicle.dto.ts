import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { VehicleType } from '../enums/vehicle-type.enum';
import {
  booleanQueryParam,
  orderByField,
  paginationQuerySchema,
} from 'src/common/dtos/pagination-query.schema';

export const queryVehicleSchema = paginationQuerySchema.extend({
  search: z.string().trim().optional(),
  vehicleType: z
    .nativeEnum(VehicleType, {
      errorMap: () => ({
        message: `Tipo de veículo deve ser um de: ${Object.values(VehicleType).join(', ')}`,
      }),
    })
    .array()
    .optional(),
  isActive: booleanQueryParam('isActive'),
  companyId: z.string().optional(),
  orderBy: orderByField(['plate', 'year', 'brand', 'createdAt']),
});

export class QueryVehicleDto extends createZodDto(queryVehicleSchema) {}
