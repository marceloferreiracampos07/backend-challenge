import { Module } from '@nestjs/common';
import { VehiclesController } from './controller/vehicles.controller';
import { AbilityModule } from '../ability/ability.module';
import { CompanyScopeResolver } from 'src/common/services/company-scope.resolver';
import { VehiclesService } from './service/vehicles.service';

@Module({
  imports: [AbilityModule],
  controllers: [VehiclesController],
  providers: [VehiclesService, CompanyScopeResolver],
  exports: [VehiclesService],
})
export class VehiclesModule {}
