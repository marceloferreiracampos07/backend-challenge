import { Module } from '@nestjs/common';
import { RefuelingsService } from './service/refueling.service';
import { RefuelingsController } from './controller/refueling.controller';
import { PrismaModule } from 'src/prisma/prisma.module';
import { AbilityModule } from 'src/modules/ability/ability.module';

@Module({
  imports: [PrismaModule, AbilityModule],
  controllers: [RefuelingsController],
  providers: [RefuelingsService],
  exports: [RefuelingsService],
})
export class RefuelingsModule {}