import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';
import { Can } from 'src/common/decorators/can.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { AuthUser } from 'src/common/interfaces/auth-user.interface';
import { RefuelingsService } from '../service/refueling.service';
import { CreateRefuelingDto } from '../Dto/create-refueling.dto';
import { QueryRefuelingDto } from '../Dto/query-refueling.dto';
import { ConsumptionQueryDto } from '../Dto/query-refueling.dto';

@Controller('vehicles')
export class RefuelingsController {
  constructor(private readonly refuelingsService: RefuelingsService) {}

  @Can('create', 'Vehicle')
  @Post(':id/refuelings')
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Param('id') id: string,
    @Body() dto: CreateRefuelingDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.refuelingsService.create(id, dto, user);
  }

  @Can('read', 'Vehicle')
  @Get(':id/refuelings')
  async findAll(
    @Param('id') id: string,
    @Query() query: QueryRefuelingDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.refuelingsService.findAll(id, query, user);
  }

  @Can('read', 'Vehicle')
  @Get(':id/consumption')
  async getConsumption(
    @Param('id') id: string,
    @Query() query: ConsumptionQueryDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.refuelingsService.getConsumptionReport(id, query, user);
  }
}