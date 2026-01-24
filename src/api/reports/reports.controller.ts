import { Controller, Get, Param, ParseDatePipe, Res, Query } from '@nestjs/common';
import archiver from 'archiver';

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

  @Get('/reporte-cleaner-zip')
  async reporteCleanerZip(
    @Res() response: Response,
    @Query('startDate', new ParseDatePipe()) startDate: string,
    @Query('endDate', new ParseDatePipe()) endDate: string
  ) {
    const { zipName, files } = await this.reportsService.reporteCleanerZip(startDate, endDate);
    response.setHeader('Content-Type', 'application/zip');
    response.setHeader('Content-Disposition', `attachment; filename="${zipName}"`);

    const archive = archiver('zip', { zlib: { level: 9 } });
    const finalizePromise = new Promise<void>((resolve, reject) => {
      archive.on('warning', err => {
        if (err.code === 'ENOENT') {
          return;
        }
        reject(err);
      });
      archive.on('error', reject);
      archive.on('end', resolve);
    });

    archive.pipe(response);
    files.forEach(file => archive.append(file.buffer, { name: file.fileName }));
    archive.finalize();

    await finalizePromise;
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
