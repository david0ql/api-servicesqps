import { Controller, Get, Param, ParseDatePipe, Res, Query } from '@nestjs/common';

import { Response } from 'express';

import { ReportsService } from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) { }

  @Get('/reporte-general')
  async reporteGeneral(
    @Res() response: Response, 
    @Query('startDate', new ParseDatePipe()) startDate: string,
    @Query('endDate', new ParseDatePipe()) endDate: string
  ) {
    const pdfDoc = await this.reportsService.reporteGeneral(startDate, endDate);
    response.setHeader('Content-Type', 'application/pdf');
    pdfDoc.pipe(response);
    pdfDoc.end();
  }

  @Get('/reporte-cleaner')
  async reporteCleaner(
    @Res() response: Response, 
    @Query('startDate', new ParseDatePipe()) startDate: string,
    @Query('endDate', new ParseDatePipe()) endDate: string
  ) {
    const pdfDoc = await this.reportsService.reporteCleaner(startDate, endDate);
    response.setHeader('Content-Type', 'application/pdf');
    pdfDoc.pipe(response);
    pdfDoc.end();
  }

  @Get('/costos-semana')
  async costosSemana(
    @Res() response: Response, 
    @Query('startDate', new ParseDatePipe()) startDate: string,
    @Query('endDate', new ParseDatePipe()) endDate: string
  ) {
    const pdfDoc = await this.reportsService.costosSemana(startDate, endDate);
    response.setHeader('Content-Type', 'application/pdf');
    pdfDoc.pipe(response);
    pdfDoc.end();
  }

  @Get('/community/:communityId')
  async reportByCommunity(@Res() response: Response, @Param('communityId') communityId: string) {
    const pdfDoc = await this.reportsService.reportByCommunity(communityId);
    response.setHeader('Content-Type', 'application/pdf');
    pdfDoc.pipe(response);
    pdfDoc.end();
  }
}
