import { Controller, Get, Param, ParseDatePipe, Res } from '@nestjs/common';

import { Response } from 'express';

import { ReportsService } from './reports.service';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) { }

  @Get('/reporte-general/:date')
  async reporteGeneral(@Res() response: Response, @Param('date', new ParseDatePipe()) date: string) {
    const pdfDoc = await this.reportsService.reporteGeneral(date);
    response.setHeader('Content-Type', 'application/pdf');
    pdfDoc.pipe(response);
    pdfDoc.end();
  }

  @Get('/reporte-cleaner/:date')
  async reporteCleaner(@Res() response: Response, @Param('date', new ParseDatePipe()) date: string) {
    const pdfDoc = await this.reportsService.reporteCleaner(date);
    response.setHeader('Content-Type', 'application/pdf');
    pdfDoc.pipe(response);
    pdfDoc.end();
  }

  @Get('/costos-semana/:date')
  async costosSemana(@Res() response: Response, @Param('date', new ParseDatePipe()) date: string) {
    const pdfDoc = await this.reportsService.costosSemana(date);
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
