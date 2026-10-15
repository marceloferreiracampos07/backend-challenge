import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth } from '@nestjs/swagger';
import { Can } from 'src/common/decorators/can.decorator';
import { CurrentUser } from 'src/common/decorators/current-user.decorator';
import { AuthUser } from 'src/common/interfaces/auth-user.interface';
import { CreateCompanyDto } from '../dtos/create-company.dto';
import { QueryCompanyDto } from '../dtos/query-company.dto';
import { UpdateCompanyDto } from '../dtos/update-company.dto';
import { CompaniesService } from '../services/companies.service';

@ApiBearerAuth()
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Can('create', 'Company')
  @Post()
  @HttpCode(HttpStatus.CREATED)
  async create(@Body() createCompanyDto: CreateCompanyDto) {
    return this.companiesService.create(createCompanyDto);
  }

  @Can('read', 'Company')
  @Get()
  async findAll(@Query() query: QueryCompanyDto, @CurrentUser() user: AuthUser) {
    return this.companiesService.findAll(query, user);
  }

  @Can('read', 'Company')
  @Get(':id')
  async findOne(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    return this.companiesService.findOne(id, user);
  }

  @Can('update', 'Company')
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() updateCompanyDto: UpdateCompanyDto,
    @CurrentUser() user: AuthUser,
  ) {
    return this.companiesService.update(id, updateCompanyDto, user);
  }

  @Can('delete', 'Company')
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Param('id') id: string, @CurrentUser() user: AuthUser) {
    await this.companiesService.remove(id, user);
  }
}
