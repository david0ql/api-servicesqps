import { Controller, Get, Param, Res, Query, NotFoundException, UseGuards, Request, ForbiddenException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import archiver from 'archiver';

import { Response } from 'express';

import { ReportsService } from './reports.service';

const ROL_VENDEDOR = '8';
const ROL_ADMIN = '1';

@Controller('reports')
export class ReportsController {
  constructor(private readonly reportsService: ReportsService) { }

  @Get('/reporte-general')
  async reporteGeneral(
    @Res() response: Response,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string
  ) {
    const pdfDoc = await this.reportsService.reporteGeneral(startDate, endDate);
    response.setHeader('Content-Type', 'application/pdf');
    pdfDoc.pipe(response);
    pdfDoc.end();
  }

  @Get('/reporte-cleaner')
  async reporteCleaner(
    @Res() response: Response,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string
  ) {
    const pdfDoc = await this.reportsService.reporteCleaner(startDate, endDate);
    response.setHeader('Content-Type', 'application/pdf');
    pdfDoc.pipe(response);
    pdfDoc.end();
  }

  /** El vendedor solo puede ver LO SUYO: el id sale del token, no de la URL. */
  @Get('/mis-comisiones')
  @UseGuards(AuthGuard('jwt'))
  async misComisiones(
    @Request() req: any,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const usuario = req.user.user;
    if (usuario.roleId !== ROL_VENDEDOR && usuario.roleId !== ROL_ADMIN) {
      throw new ForbiddenException('Solo los vendedores asociados pueden consultar sus comisiones.');
    }
    return this.reportsService.reporteVendedor(usuario.id, startDate, endDate);
  }

  @Get('/reporte-cleaner-individual')
  async reporteCleanerIndividual(
    @Res() response: Response,
    @Query('userId') userId: string,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string
  ) {
    const { fileName, buffer } = await this.reportsService.reporteCleanerIndividual(userId, startDate, endDate);
    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    response.end(buffer);
  }

  @Get('/reporte-cleaner-zip')
  async reporteCleanerZip(
    @Res() response: Response,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string
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
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string
  ) {
    const pdfDoc = await this.reportsService.costosSemana(startDate, endDate);
    response.setHeader('Content-Type', 'application/pdf');
    pdfDoc.pipe(response);
    pdfDoc.end();
  }

  @Get('/community/:communityId')
  async reportByCommunity(
    @Res() response: Response,
    @Param('communityId') communityId: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    const pdfDoc = await this.reportsService.reportByCommunity(communityId, startDate, endDate);
    response.setHeader('Content-Type', 'application/pdf');
    pdfDoc.pipe(response);
    pdfDoc.end();
  }

  @Get('/cleaner/:token')
  async reportByCleanerToken(@Res() response: Response, @Param('token') token: string) {
    const result = await this.reportsService.reportByCleanerToken(token);
    if (!result) {
      throw new NotFoundException('Report link is invalid or expired.');
    }

    response.setHeader('Content-Type', 'application/pdf');
    response.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`);
    response.send(result.buffer);
  }
}
