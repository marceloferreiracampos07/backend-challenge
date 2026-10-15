import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { VehicleType } from '../enums/vehicle-type.enum';
import { plateSchema } from './plate.schema';

const maxAllowedYear = new Date().getFullYear() + 1;

export const updateVehicleSchema = z.object({
  plate: plateSchema.optional(),
  brand: z
    .string()
    .trim()
    .min(2, { message: 'Marca deve ter no mínimo 2 caracteres' })
    .max(50, { message: 'Marca deve ter no máximo 50 caracteres' })
    .optional(),
  model: z
    .string()
    .trim()
    .min(2, { message: 'Modelo deve ter no mínimo 2 caracteres' })
    .max(50, { message: 'Modelo deve ter no máximo 50 caracteres' })
    .optional(),
  year: z
    .number()
    .int({ message: 'Ano deve ser um número inteiro' })
    .min(1950, { message: 'Ano deve ser no mínimo 1950' })
    .max(maxAllowedYear, { message: `Ano deve ser no máximo ${maxAllowedYear}` })
    .optional(),
  vehicleType: z
    .nativeEnum(VehicleType, {
      errorMap: () => ({
        message: `Tipo de veículo deve ser um de: ${Object.values(VehicleType).join(', ')}`,
      }),
    })
    .optional(),
  isActive: z.boolean({ invalid_type_error: 'isActive deve ser booleano' }).optional(),
  description: z
    .string()
    .max(255, { message: 'Descrição deve ter no máximo 255 caracteres' })
    .optional(),
});

export class UpdateVehicleDto extends createZodDto(updateVehicleSchema) {}
