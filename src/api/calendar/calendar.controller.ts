import { Controller, Get, Query, ParseIntPipe } from '@nestjs/common';
import { ApiQuery } from '@nestjs/swagger';

import { CalendarService } from './calendar.service';

import { CalendarEnum } from './dto/calendar.dto';

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
  findOne(@Query('type') type: string) {
    return this.calendarService.findOne(type);
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
  findByYearAndMonth(
    @Query('year', ParseIntPipe) year: number,
    @Query('month', ParseIntPipe) month: number,
  ) {
    return this.calendarService.findByYearAndMonth(year, month);
  }
}
