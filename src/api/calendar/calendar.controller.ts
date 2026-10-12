import { BadRequestException, Controller, Get, Query, ParseIntPipe, Request, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AuthGuard } from '@nestjs/passport';

import { CalendarService } from './calendar.service';

import { CalendarEnum } from './dto/calendar.dto';

@ApiBearerAuth()
@Controller('calendar')
export class CalendarController {
  constructor(private readonly calendarService: CalendarService) { }
  @ApiQuery({
    name: 'type',
    required: false,
    enum: CalendarEnum,
    description: 'Calendar type',
  })
  @Get()
  @UseGuards(AuthGuard('jwt'))
  findOne(@Query('type') type: string, @Request() req: any) {
    return this.calendarService.findOne(type, req.user.user);
  }

  @ApiQuery({
    name: 'year',
    required: true,
    type: Number,
    description: 'Year (e.g., 2024)',
  })
  @ApiQuery({
    name: 'month',
    required: true,
    type: Number,
    description: 'Month (1-12)',
  })
  @Get('by-month')
  @UseGuards(AuthGuard('jwt'))
  findByYearAndMonth(
    @Query('year', ParseIntPipe) year: number,
    @Query('month', ParseIntPipe) month: number,
    @Request() req: any,
  ) {
    return this.calendarService.findByYearAndMonth(year, month, req.user.user);
  }

  @ApiQuery({
    name: 'startDate',
    required: true,
    type: String,
    description: 'Start date (YYYY-MM-DD), inclusive',
  })
  @ApiQuery({
    name: 'endDate',
    required: true,
    type: String,
    description: 'End date (YYYY-MM-DD), inclusive',
  })
  @Get('by-range')
  @UseGuards(AuthGuard('jwt'))
  findByRange(
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
    @Request() req: any,
  ) {
    const isoDate = /^\d{4}-\d{2}-\d{2}$/;
    if (!isoDate.test(startDate ?? '') || !isoDate.test(endDate ?? '')) {
      throw new BadRequestException('startDate y endDate deben tener formato YYYY-MM-DD');
    }
    if (startDate > endDate) {
      throw new BadRequestException('startDate no puede ser mayor que endDate');
    }
    return this.calendarService.findByRange(startDate, endDate, req.user.user);
  }
}
