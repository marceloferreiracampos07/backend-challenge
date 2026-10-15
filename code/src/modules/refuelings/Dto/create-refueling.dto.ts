import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';

export const createRefuelingSchema = z.object({
  date: z.coerce.date({ required_error: 'Data é obrigatória' }),
  liters: z
    .number({ required_error: 'Litros são obrigatórios' })
    .positive({ message: 'Litros devem ser maiores que zero' }),
  totalValue: z
    .number({ required_error: 'Valor total é obrigatório' })
    .positive({ message: 'Valor total deve ser maior que zero' }),
  odometer: z
    .number({ required_error: 'Hodômetro é obrigatório' })
    .int({ message: 'Hodômetro deve ser um número inteiro' })
    .nonnegative({ message: 'Hodômetro deve ser positivo' }),
});

export class CreateRefuelingDto extends createZodDto(createRefuelingSchema) {}