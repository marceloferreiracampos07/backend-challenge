import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { VehicleType } from '../enums/vehicle-type.enum';

// Correção: removida a barra invertida antes do cifrão ($)
const platePattern = /^[A-Za-z0-9-]+$/;
const maxAllowedYear = new Date().getFullYear() + 1;

export const createVehicleSchema = z.object({
  plate: z
    .string({ required_error: 'Placa é obrigatória' })
    .trim()
    .refine(
      val => platePattern.test(val),
      { message: 'Placa deve conter apenas letras, números e hífen' },
    )
    // Remove o hífen e converte para maiúsculo para caber no limite da coluna do banco
    .transform(val => val.replace(/-/g, '').toUpperCase())
    .refine(
      val => {
        const clean = val.toUpperCase();
        return clean.length >= 3 && clean.length <= 7;
      },
      { message: 'Placa deve ter entre 3 e 7 caracteres (sem contar hífen)' },
    ),
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
    errorMap: () => ({ message: `Tipo de veículo deve ser um de: ${Object.values(VehicleType).join(', ')}` }),
  }),
  isActive: z.boolean({ invalid_type_error: 'isActive deve ser booleano' }).default(true),
  description: z
    .string()
    .max(255, { message: 'Descrição deve ter no máximo 255 caracteres' })
    .optional(),
  companyId: z.string({ required_error: 'Company ID é obrigatório' }).uuid().optional(),
});

export class CreateVehicleDto extends createZodDto(createVehicleSchema) {}