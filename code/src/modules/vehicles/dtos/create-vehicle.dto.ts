import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { VehicleType } from '../enums/vehicle-type.enum';
import { plateSchema } from './plate.schema';

const maxAllowedYear = new Date().getFullYear() + 1;

export const createVehicleSchema = z.object({
  plate: plateSchema,
  brand: z
    .string({ required_error: 'Marca é obrigatória' })
    .trim()
    .min(2, { message: 'Marca deve ter no mínimo 2 caracteres' })
    .max(50, { message: 'Marca deve ter no máximo 50 caracteres' }),
  model: z
    .string({ required_error: 'Modelo é obrigatório' })
    .trim()
    .min(2, { message: 'Modelo deve ter no mínimo 2 caracteres' })
    .max(50, { message: 'Modelo deve ter no máximo 50 caracteres' }),
  year: z
    .number({ required_error: 'Ano é obrigatório' })
    .int({ message: 'Ano deve ser um número inteiro' })
    .min(1950, { message: 'Ano deve ser no mínimo 1950' })
    .max(maxAllowedYear, {
      message: `Ano deve ser no máximo ${maxAllowedYear}`,
    }),
  vehicleType: z.nativeEnum(VehicleType, {
    errorMap: () => ({
      message: `Tipo de veículo deve ser um de: ${Object.values(VehicleType).join(', ')}`,
    }),
  }),
  isActive: z.boolean({ invalid_type_error: 'isActive deve ser booleano' }).default(true),
  description: z
    .string()
    .max(255, { message: 'Descrição deve ter no máximo 255 caracteres' })
    .optional(),
  companyId: z.string({ required_error: 'Company ID é obrigatório' }).cuid2().optional(),
});

export class CreateVehicleDto extends createZodDto(createVehicleSchema) {}
