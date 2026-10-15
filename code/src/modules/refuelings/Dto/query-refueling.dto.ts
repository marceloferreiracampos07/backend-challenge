import { createZodDto } from 'nestjs-zod';
import { z } from 'zod';
import { paginationQuerySchema } from 'src/common/dtos/pagination-query.schema';

export const queryRefuelingSchema = paginationQuerySchema;
export class QueryRefuelingDto extends createZodDto(queryRefuelingSchema) {}

export const consumptionQuerySchema = z.object({
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'startDate deve estar no formato AAAA-MM-DD',
  }),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'endDate deve estar no formato AAAA-MM-DD',
  }),
});

export class ConsumptionQueryDto extends createZodDto(consumptionQuerySchema) {}
