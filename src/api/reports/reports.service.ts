import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Cron } from '@nestjs/schedule';
import { randomUUID } from 'crypto';

import moment from 'moment';
import type { Content, StyleDictionary, TDocumentDefinitions, BufferOptions, CustomTableLayout } from 'pdfmake/interfaces';
import { CostsEntity } from '../../entities/costs.entity';
import { RecurringCostsEntity } from '../../entities/recurring_costs.entity';
import { Between, In, Repository } from 'typeorm';
import { ServicesEntity } from '../../entities/services.entity';
import { ExtrasByServiceEntity } from '../../entities/extras_by_service.entity';
import { PrinterService } from '../../printer/printer.service';
import { CommunitiesEntity } from '../../entities/communities.entity';
import { UsersEntity } from '../../entities/users.entity';
import { CleanerReportLinksEntity } from '../../entities/cleaner_report_links.entity';
import { TextBeeService } from '../../textbee/textbee.service';
import envVars from '../../config/env';
import { buildShareholderShares } from './shareholder-shares.util';
const PdfPrinter = require('pdfmake');

const styles: StyleDictionary = {
  header: {
    fontSize: 10,
    bold: true,
    alignment: 'center',
    margin: [0, 60, 0, 20],
  },
  body: {
    alignment: 'justify',
    margin: [0, 0, 0, 70],
  },
  footer: {
    fontSize: 10,
    italics: true,
    alignment: 'center',
    margin: [0, 0, 0, 20],
  }
}

const logo: Content = {
  image: 'src/assets/logo.png',
  width: 150,
  alignment: 'center',
}

const customTableLayouts: Record<string, CustomTableLayout> = {
    customLayout01: {
        hLineWidth: function (i, node) {
            if (i === 0 || i === node.table.body.length) {
                return 0;
            }
            return i === node.table.headerRows ? 2 : 1;
        },
        vLineWidth: function (i) {
            return 0;
        },
        hLineColor: function (i) {
            return i === 1 ? 'black' : '#bbbbbb';
        },
        paddingLeft: function (i) {
            return i === 0 ? 0 : 8;
        },
        paddingRight: function (i, node) {
            return i === node.table.widths.length - 1 ? 0 : 8;
        },
        fillColor: function (rowIndex, node, columnIndex) {
            // Si es el encabezado
            if (rowIndex === 0) {
                return '#7b90be';
            }
            // Si es la última fila (totales)
            if (rowIndex === node.table.body.length - 1) {
                return '#acb3c1';
            }
            
            // Obtener el contenido de la celda de Unit number (columna 2)
            const row = node.table.body[rowIndex];
            if (row && Array.isArray(row) && String(row[2]).toLowerCase() === 'leasing center') {
                return '#ff0000';
            }
            
            // Patrón zebra para las demás filas
            return rowIndex % 2 === 0 ? '#f3f3f3' : null;
        }
    },
};

@Injectable()
export class ReportsService {
  private readonly logger = new Logger(ReportsService.name);

  constructor(
    private readonly printerService: PrinterService,
    @InjectRepository(CostsEntity)
    private costsRepository: Repository<CostsEntity>,
    @InjectRepository(RecurringCostsEntity)
    private recurringCostsRepository: Repository<RecurringCostsEntity>,
    @InjectRepository(ServicesEntity)
    private readonly servicesRepository: Repository<ServicesEntity>,
    @InjectRepository(CommunitiesEntity)
    private readonly communityRepository: Repository<CommunitiesEntity>,
    @InjectRepository(UsersEntity)
    private readonly usersRepository: Repository<UsersEntity>,
    @InjectRepository(CleanerReportLinksEntity)
    private readonly cleanerReportLinksRepository: Repository<CleanerReportLinksEntity>,
    private readonly textBeeService: TextBeeService,
  ) { }

  async reporteGeneral(startDate: string, endDate: string) {
    const startOfWeek = moment(startDate).format('YYYY-MM-DD');
    const endOfWeek = moment(endDate).format('YYYY-MM-DD');

    const today = moment();

    const queryBuilder = this.servicesRepository.createQueryBuilder('services');

    queryBuilder
      .leftJoinAndSelect('services.community', 'community')
      .leftJoinAndSelect('services.type', 'type')
      .leftJoinAndSelect('services.status', 'status')
      .leftJoinAndSelect('services.user', 'user')
      .leftJoinAndSelect('services.extrasByServices', 'extrasByServices')
      .leftJoinAndSelect('extrasByServices.extra', 'extra')
      .where('services.date BETWEEN :startOfWeek AND :endOfWeek', { startOfWeek, endOfWeek });

    const services = await queryBuilder.getMany();

    // Agrupar servicios por comunidad
    const servicesByCommunity = new Map<string, ServicesEntity[]>();
    services.forEach(service => {
      const communityName = service.community?.communityName || "Sin Comunidad";
      if (!servicesByCommunity.has(communityName)) {
        servicesByCommunity.set(communityName, []);
      }
      servicesByCommunity.get(communityName).push(service);
    });

    // Ordenar servicios por fecha descendente dentro de cada comunidad
    servicesByCommunity.forEach((communityServices, communityName) => {
      communityServices.sort((a, b) => moment(b.date).valueOf() - moment(a.date).valueOf());
    });

    const servicesDashboard = services.map(service => {
      const totalExtrasByService = service.extrasByServices?.reduce((acc, extraByService) => {
        const commission = extraByService?.extra?.commission ?? 0;
        return acc + Number(commission);
      }, 0) ?? 0;

      const typeCommission = service.type?.commission ?? 0;
      const typePrice = service.type?.price ?? 0;

      const totalCleaner = Number(totalExtrasByService) + Number(typeCommission);
      const totalNotAdjusted = Number(typePrice) - Number(typeCommission) - Number(totalExtrasByService);

      const totalParner = totalNotAdjusted * 0.4;
      const total = totalNotAdjusted * 0.6;

      return {
        ...service,
        totalCleaner,
        totalParner,
        total,
      };
    });

    const formatCurrency = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

    // Totales
    const totalServicePrice = servicesDashboard.reduce((acc, service) => acc + Number(service.type?.price ?? 0), 0);
    const totalServiceCommission = servicesDashboard.reduce((acc, service) => acc + Number(service.type?.commission ?? 0), 0);
    const totalExtrasPrice = servicesDashboard.reduce((acc, service) =>
      acc + (service.extrasByServices?.reduce((sum, extraByService) => sum + Number(extraByService?.extra?.itemPrice ?? 0), 0) ?? 0), 0);
    const totalExtrasCommission = servicesDashboard.reduce((acc, service) =>
      acc + (service.extrasByServices?.reduce((sum, extraByService) => sum + Number(extraByService?.extra?.commission ?? 0), 0) ?? 0), 0);
    const totalCleanerSum = totalServiceCommission + totalExtrasCommission;

    // ---------- Sección de la tabla de Costos ----------
    const costs = [];

    const costsVariables = await this.costsRepository.find({
      where: {
        date: Between(startOfWeek, endOfWeek),
      },
    });

    const recurringCosts = await this.getRecurringCosts(startOfWeek, endOfWeek);

    costs.push(
      ...recurringCosts.map(cost => ({
        date: moment(endOfWeek).format('YYYY-MM-DD'),
        description: cost.description,
        amount: cost.amount,
      })),
      ...costsVariables,
    );

    const totalCosts = costs.reduce((sum, cost) => sum + Number(cost.amount), 0);
    
    // Cálculo correcto del beneficio neto
    const netProfit = (totalServicePrice + totalExtrasPrice - totalCleanerSum - totalCosts);
    
    const shareholderShares = buildShareholderShares(endOfWeek, netProfit);

    // Generar tabla agrupada por comunidad
    const tableBody = [
      ['Date', 'Community', 'Unit number', 'Type', 'Service Price', 'Service comission', 'Extras price', 'Extras comission', 'Total cleaner', 'Cleaner'].map(header => ({
        text: header,
        fillColor: '#7b90be',
        color: '#ffffff'
      }))
    ];

    // Agregar servicios agrupados por comunidad
    servicesByCommunity.forEach((communityServices, communityName) => {
      // Agregar header de comunidad
      tableBody.push([
        { text: communityName, fillColor: '#e6e6e6', color: '#000000' },
        { text: '', fillColor: '#e6e6e6', color: '#000000' },
        { text: '', fillColor: '#e6e6e6', color: '#000000' },
        { text: '', fillColor: '#e6e6e6', color: '#000000' },
        { text: '', fillColor: '#e6e6e6', color: '#000000' },
        { text: '', fillColor: '#e6e6e6', color: '#000000' },
        { text: '', fillColor: '#e6e6e6', color: '#000000' },
        { text: '', fillColor: '#e6e6e6', color: '#000000' },
        { text: '', fillColor: '#e6e6e6', color: '#000000' },
        { text: '', fillColor: '#e6e6e6', color: '#000000' }
      ]);

      // Agregar servicios de esta comunidad
      communityServices.forEach(service => {
        const serviceDashboard = servicesDashboard.find(s => s.id === service.id);
        const isLeasingCenter = service.unitNumber?.toLowerCase() === 'leasing center';
        const textColor = isLeasingCenter ? '#ff0000' : null;
        
        // Create type display string with description and cleaning type
        const typeDisplay = service.type 
          ? `${service.type.cleaningType} (${service.type.description})`
          : 'N/A';
        
        tableBody.push([
          { text: moment(service.date).format('MM/DD/YYYY'), color: textColor, fillColor: null },
          { text: service.community?.communityName ?? 'N/A', color: textColor, fillColor: null },
          { text: service.unitNumber ?? 'N/A', color: textColor, fillColor: null },
          { text: typeDisplay, color: textColor, fillColor: null },
          { text: formatCurrency(Number(service.type?.price ?? 0)), color: textColor, fillColor: null },
          { text: formatCurrency(Number(service.type?.commission ?? 0)), color: textColor, fillColor: null },
          { text: formatCurrency(service.extrasByServices?.reduce((acc, extraByService) => acc + Number(extraByService?.extra?.itemPrice ?? 0), 0) ?? 0), color: textColor, fillColor: null },
          { text: formatCurrency(service.extrasByServices?.reduce((acc, extraByService) => acc + Number(extraByService?.extra?.commission ?? 0), 0) ?? 0), color: textColor, fillColor: null },
          { text: formatCurrency(Number(serviceDashboard?.totalCleaner ?? 0)), color: textColor, fillColor: null },
          { text: service.user?.name ?? 'N/A', color: textColor, fillColor: null }
        ]);
      });
    });

    // Agregar fila de totales
    tableBody.push([
      { text: '', fillColor: '#acb3c1', color: null },
      { text: '', fillColor: '#acb3c1', color: null },
      { text: 'Total', fillColor: '#acb3c1', color: null },
      { text: '', fillColor: '#acb3c1', color: null },
      { text: formatCurrency(totalServicePrice), fillColor: '#acb3c1', color: null },
      { text: formatCurrency(totalServiceCommission), fillColor: '#acb3c1', color: null },
      { text: formatCurrency(totalExtrasPrice), fillColor: '#acb3c1', color: null },
      { text: formatCurrency(totalExtrasCommission), fillColor: '#acb3c1', color: null },
      { text: formatCurrency(totalCleanerSum), fillColor: '#acb3c1', color: null },
      { text: '', fillColor: '#acb3c1', color: null }
    ]);

    // Nueva tabla de comisiones con costos
    const comisionesTableBody = [
      ['Accionista', 'Porcentaje', 'Ganancia Neta'],
      ...shareholderShares.map(share => ([
        share.name,
        `${Math.round(share.percentage * 100)}%`,
        formatCurrency(share.amount),
      ])),
      [
        'Total',
        `${Math.round(shareholderShares.reduce((sum, share) => sum + share.percentage, 0) * 100)}%`,
        formatCurrency(shareholderShares.reduce((sum, share) => sum + share.amount, 0))
      ]
    ];

    const costosTableBody = [
      ['Date', 'Description', 'Amount'],
      ...costs.map(cost => [
        moment(cost.date).format('MM/DD/YYYY'),
        cost.description,
        `$${Number(cost.amount).toFixed(2)}`,
      ]),
      ['', 'Total', `$${costs.reduce((sum, cost) => sum + Number(cost.amount), 0).toFixed(2)}`]
    ];

    // Integrar todos los reportes en un solo PDF
    const docDefinition: TDocumentDefinitions = {
      styles,
      pageMargins: [40, 120, 40, 60],
      pageOrientation: 'landscape',
      pageSize: 'C3',
      header: {
        columns: [
          logo,
          {
            text: `Service Report - Week ${moment(startOfWeek).format('MM/DD/YYYY')} to ${moment(endOfWeek).format('MM/DD/YYYY')}`,
            style: 'header',
          },
          {
            fontSize: 10,
            text: today.format('LL'),
            italics: true,
            alignment: 'right',
            margin: [20, 20],
          }
        ],
      },
      content: [
        {
          text: 'Service Report',
          style: 'subheader',
          margin: [0, 10, 0, 10],
        },
        {
          table: {
            headerRows: 1,
            widths: ['*', '*', '*', '*', '*', '*', '*', '*', '*', '*'],
            body: tableBody
          }
        },
        {
          text: 'Reporte de Comisiones por Accionista',
          style: 'subheader',
          margin: [0, 20, 0, 10],
        },
        {
          layout: 'customLayout01',
          table: {
            headerRows: 1,
            widths: ['*', 'auto', 'auto'],
            body: comisionesTableBody
          }
        },
        {
          text: 'Weekly Costs',
          style: 'subheader',
          margin: [0, 20, 0, 10],
        },
        {
          layout: 'customLayout01',
          table: {
            headerRows: 1,
            widths: ['auto', '*', 'auto'],
            body: costosTableBody
          }
        }
      ],
      footer: {
        text: `© ${moment().format('YYYY')} Services QPS. Este documento es confidencial y no puede ser compartido.`,
        style: 'footer',
      }
    };

    const doc = this.printerService.createPDF(docDefinition);

    doc.info.Title = `Service Report ${startOfWeek} - ${endOfWeek}`;

    return doc;
  }

  async reporteCleaner(startDate: string, endDate: string) {
    const startOfWeek = moment(startDate).format('YYYY-MM-DD');
    const endOfWeek = moment(endDate).format('YYYY-MM-DD');
    const today = moment();

    const queryBuilder = this.servicesRepository.createQueryBuilder('services');

    queryBuilder
      .leftJoinAndSelect('services.community', 'community')
      .leftJoinAndSelect('services.type', 'type')
      .leftJoinAndSelect('services.status', 'status')
      .leftJoinAndSelect('services.user', 'user')
      .leftJoinAndSelect('services.extrasByServices', 'extrasByServices')
      .leftJoinAndSelect('extrasByServices.extra', 'extra')
      .where('services.date BETWEEN :startOfWeek AND :endOfWeek', { startOfWeek, endOfWeek });

    const services = await queryBuilder.getMany();

    // Agrupar por cleaner
    const cleanersMap = new Map<string, ServicesEntity[]>();
    services.forEach(service => {
      const cleanerName = service.user?.name || "N/A";
      if (!cleanersMap.has(cleanerName)) {
        cleanersMap.set(cleanerName, []);
      }
      cleanersMap.get(cleanerName).push(service);
    });

    const formatCurrency = (value: number) =>
      new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

    const content = [];

    cleanersMap.forEach((services, cleanerName) => {
      const servicesDashboard = services.map(service => {
        const totalExtrasByService = service.extrasByServices?.reduce((acc, extraByService) => {
          const commission = extraByService?.extra?.commission ?? 0;
          return acc + Number(commission);
        }, 0) ?? 0;

        const typeCommission = service.type?.commission ?? 0;
        const typePrice = service.type?.price ?? 0;

        const totalCleaner = Number(totalExtrasByService) + Number(typeCommission);
        const totalNotAdjusted = Number(typePrice) - Number(typeCommission) - Number(totalExtrasByService);

        const totalParner = totalNotAdjusted * 0.4;
        const total = totalNotAdjusted * 0.6;

        return {
          ...service,
          totalCleaner,
          totalParner,
          total,
        };
      });

      // Calcular totales para este cleaner
      const totalCommission = servicesDashboard.reduce((acc, service) => acc + Number(service.type?.commission ?? 0), 0);
      const totalExtras = servicesDashboard.reduce((acc, service) => 
        acc + (service.extrasByServices?.reduce((sum, extraByService) => 
          sum + Number(extraByService?.extra?.commission ?? 0), 0) ?? 0), 0);
      const totalCleanerAmount = servicesDashboard.reduce((acc, service) => acc + Number(service.totalCleaner ?? 0), 0);

      const tableBody = [
        ['Date', 'Community', 'Unit number', 'Type', 'Commission', 'Extras', 'Total'],
        ...servicesDashboard.map(service => [
          moment(service.date).format('MM/DD/YYYY'),
          service.community?.communityName ?? 'N/A',
          service.unitNumber ?? 'N/A',
          'Total:',
          formatCurrency(Number(service.type?.commission ?? 0)),
          formatCurrency(service.extrasByServices?.reduce((acc, extraByService) => acc + Number(extraByService?.extra?.commission ?? 0), 0) ?? 0),
          formatCurrency(Number(service.totalCleaner ?? 0)),
        ]),
        // Fila de totales
        [
          '',
          '',
          'Total: ',
          '',
          formatCurrency(totalCommission),
          formatCurrency(totalExtras),
          formatCurrency(totalCleanerAmount)
        ].map(cell => ({
          text: cell,
          fillColor: '#acb3c1',
          color: '#000000'
        }))
      ];

      content.push(
        {
          text: `Cleaner: ${cleanerName}`,
          style: 'subheader',
          margin: [0, 10, 0, 10],
          pageBreak: content.length > 0 ? 'before' : undefined,
        },
        {
          layout: 'customLayout01',
          table: {
            headerRows: 1,
            widths: ['*', '*', '*', '*', '*', '*', '*'],
            body: tableBody,
          },
        }
      );
    });

    const docDefinition: TDocumentDefinitions = {
      styles,
      pageMargins: [40, 120, 40, 60],
      pageOrientation: 'landscape',
      pageSize: 'LETTER',
      header: (currentPage, pageCount) => ({
        columns: [
          logo,
          {
            text: `Cleaner Report - Week ${moment(startOfWeek).format('MM/DD/YYYY')} to ${moment(endOfWeek).format('MM/DD/YYYY')}`,
            style: 'header',
          },
          {
            fontSize: 10,
            text: `Page ${currentPage} of ${pageCount} - ${today.format('LL')}`,
            italics: true,
            alignment: 'right',
            margin: [20, 20],
          },
        ],
      }),
      content,
      footer: (currentPage, pageCount) => ({
        text: `© ${moment().format('YYYY')} Services QPS. Este documento es confidencial y no puede ser compartido.`,
        style: 'footer',
        alignment: 'center',
        margin: [0, 10, 0, 0],
      }),
    };

    const doc = this.printerService.createPDF(docDefinition);
    doc.info.Title = `Costos semana ${startOfWeek} al ${endOfWeek}`;
    return doc;
  }

  async reporteCleanerZip(startDate: string, endDate: string) {
    const startOfWeek = moment(startDate).format('YYYY-MM-DD');
    const endOfWeek = moment(endDate).format('YYYY-MM-DD');
    const today = moment();

    const queryBuilder = this.servicesRepository.createQueryBuilder('services');

    queryBuilder
      .leftJoinAndSelect('services.community', 'community')
      .leftJoinAndSelect('services.type', 'type')
      .leftJoinAndSelect('services.status', 'status')
      .leftJoinAndSelect('services.user', 'user')
      .leftJoinAndSelect('services.extrasByServices', 'extrasByServices')
      .leftJoinAndSelect('extrasByServices.extra', 'extra')
      .where('services.date BETWEEN :startOfWeek AND :endOfWeek', { startOfWeek, endOfWeek });

    const services = await queryBuilder.getMany();

    const cleanersMap = new Map<string, ServicesEntity[]>();
    services.forEach(service => {
      const cleanerName = service.user?.name || 'N/A';
      if (!cleanersMap.has(cleanerName)) {
        cleanersMap.set(cleanerName, []);
      }
      cleanersMap.get(cleanerName).push(service);
    });

    const cleanerEntries = Array.from(cleanersMap.entries());
    const poolSize = 5;
    const files: Array<{ fileName: string; buffer: Buffer }> = [];

    for (let index = 0; index < cleanerEntries.length; index += poolSize) {
      const batch = cleanerEntries.slice(index, index + poolSize);
      const batchResults = await Promise.all(
        batch.map(([cleanerName, cleanerServices]) =>
          this.buildCleanerReportBuffer(cleanerName, cleanerServices, startOfWeek, endOfWeek, today),
        ),
      );
      files.push(...batchResults);
    }

    return {
      zipName: `cleaner-reports-${startOfWeek}-to-${endOfWeek}.zip`,
      files,
    };
  }

  @Cron('0 8 * * 1', { name: 'cleaner-weekly-reports' })
  async sendWeeklyCleanerReports() {
    if (!envVars.ENABLE_SMS) {
      this.logger.log('Weekly cleaner reports skipped (ENABLE_SMS=false).');
      return;
    }

    const { startOfWeek, endOfWeek } = this.getPreviousWeekRange();

    const rawCleanerIds = await this.servicesRepository
      .createQueryBuilder('services')
      .select('DISTINCT services.userId', 'userId')
      .where('services.date BETWEEN :startOfWeek AND :endOfWeek', { startOfWeek, endOfWeek })
      .andWhere('services.userId IS NOT NULL')
      .getRawMany<{ userId: string }>();

    const cleanerIds = rawCleanerIds.map(row => row.userId).filter(Boolean);
    if (!cleanerIds.length) {
      this.logger.log('Weekly cleaner reports: no services found for the previous week.');
      return;
    }

    const cleaners = await this.usersRepository.find({
      where: { id: In(cleanerIds), roleId: '4' },
      select: ['id', 'name', 'phoneNumber', 'roleId'],
    });

    const startLabel = moment(startOfWeek).format('MM/DD/YYYY');
    const endLabel = moment(endOfWeek).format('MM/DD/YYYY');

    await Promise.all(
      cleaners.map(async (cleaner) => {
        if (!cleaner.phoneNumber) {
          return;
        }

        const link = await this.createCleanerReportLink(cleaner.id, startOfWeek, endOfWeek);
        const message = `Services QPS: Your payment report for ${startLabel} to ${endLabel} is ready: ${link}`;

        try {
          await this.textBeeService.sendSMS(cleaner.phoneNumber, message);
        } catch (error) {
          this.logger.warn(`Failed to send weekly report SMS to ${cleaner.id}`);
        }
      }),
    );
  }

  async costosSemana(startDate: string, endDate: string) {
    const startOfWeek = moment(startDate).format('YYYY-MM-DD');
    const endOfWeek = moment(endDate).format('YYYY-MM-DD');

    const today = moment();
    const costs = []

    const costsVariables = await this.costsRepository.find({
      where: {
        date: Between(startOfWeek, endOfWeek),
      },
    });

    const recurringCosts = await this.getRecurringCosts(startOfWeek, endOfWeek);

    costs.push(
      ...recurringCosts.map(cost => ({
        date: moment(endOfWeek).format('YYYY-MM-DD'),
        description: cost.description,
        amount: cost.amount,
      })),
      ...costsVariables,
    );

    const docDefinition: TDocumentDefinitions = {
      styles,
      pageMargins: [40, 120, 40, 60],
      header: {
        columns: [
          logo,
          {
            text: `Costs week ${moment(startOfWeek).format('MM/DD/YYYY')} to ${moment(endOfWeek).format('MM/DD/YYYY')}`,
            style: 'header',
          },
          {
            fontSize: 10,
            text: today.format('LL'),
            italics: true,
            alignment: 'right',
            margin: [20, 20],
          }
        ],
      },
      content: [
        {
          layout: 'customLayout01',
          table: {
            headerRows: 1,
            widths: ['*', '*', '*'],
            body: [
              ['Date', 'Description', 'Amount'],
              ...costs.map(cost => [
                moment(cost.date).format('MM/DD/YYYY'),
                cost.description,
                `$${Number(cost.amount).toFixed(2)}`,
              ]),
              ['', 'Total', `$${costs.reduce((sum, cost) => sum + Number(cost.amount), 0).toFixed(2)}`]
            ]
          }
        }
      ],
      footer: {
        text: `© ${moment().format('YYYY')} Services QPS. Este documento es confidencial y no puede ser compartido.`,
        style: 'footer',
      }
    };

    const doc = this.printerService.createPDF(docDefinition);

    doc.info.Title = `Costos semana ${startOfWeek} al ${endOfWeek}`

    return doc;
  }

  private parseReportDate(value?: string): moment.Moment | null {
    if (!value) return null;

    const formats = [
      'MM-DD-YYYY',
      'M-DD-YYYY',
      'MM-D-YYYY',
      'M-D-YYYY',
      'MM/DD/YYYY',
      'M/DD/YYYY',
      'MM/D/YYYY',
      'M/D/YYYY',
      'YYYY-MM-DD',
    ];
    const parsed = moment(value, formats, true);
    if (parsed.isValid()) return parsed;

    const fallback = moment(value);
    return fallback.isValid() ? fallback : null;
  }

  async reportByCommunity(communityId: string, startDate?: string, endDate?: string) {
    const today = moment();
    const currentYear = today.year();

    const parsedStart = this.parseReportDate(startDate);
    const parsedEnd = this.parseReportDate(endDate);
    const hasRange = Boolean(parsedStart && parsedEnd);

    const startOfRange = hasRange
      ? parsedStart!.format('YYYY-MM-DD')
      : moment().startOf('year').format('YYYY-MM-DD');
    const endOfRange = hasRange
      ? parsedEnd!.format('YYYY-MM-DD')
      : moment().endOf('year').format('YYYY-MM-DD');

    const queryBuilder = this.servicesRepository.createQueryBuilder('services');

    queryBuilder
      .leftJoinAndSelect('services.community', 'community')
      .leftJoinAndSelect('services.type', 'type')
      .leftJoinAndSelect('services.user', 'user')
      .leftJoinAndSelect('services.extrasByServices', 'extrasByServices')
      .leftJoinAndSelect('extrasByServices.extra', 'extra')
      .where('services.community_id = :communityId', { communityId })
      .andWhere('services.date BETWEEN :startOfRange AND :endOfRange', { startOfRange, endOfRange });

    const services = await queryBuilder.getMany();

    // Agrupar servicios por tipo
    const servicesByType = new Map<string, ServicesEntity[]>();
    services.forEach(service => {
      const typeKey = service.type 
        ? `${service.type.cleaningType} (${service.type.description})`
        : "Sin Tipo";
      if (!servicesByType.has(typeKey)) {
        servicesByType.set(typeKey, []);
      }
      servicesByType.get(typeKey).push(service);
    });

    // Ordenar servicios por fecha descendente dentro de cada tipo
    servicesByType.forEach((typeServices, typeName) => {
      typeServices.sort((a, b) => moment(b.date).valueOf() - moment(a.date).valueOf());
    });

    const formatCurrency = (value: number) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

    const tableBody = [
      ['Date', 'Unit number', 'Type', 'Type Price', 'Extras', 'Total'].map(header => ({
        text: header,
        fillColor: '#7b90be',
        color: '#ffffff'
      })),
      ...services.map(service => {
        const isLeasingCenter = service.unitNumber?.toLowerCase() === 'leasing center';
        const textColor = isLeasingCenter ? '#ff0000' : null;
        
        const typePrice = Number(service.type?.price ?? 0);
        const extrasTotal = service.extrasByServices?.reduce((acc, extraByService) => 
          acc + Number(extraByService?.extra?.itemPrice ?? 0), 0) ?? 0;
        const total = typePrice + extrasTotal;
        
        return [
          { text: moment(service.date).format('MM/DD/YYYY'), color: textColor },
          { text: service.unitNumber ?? 'N/A', color: textColor },
          { text: service.type?.description ?? 'N/A', color: textColor },
          { text: formatCurrency(typePrice), color: textColor },
          { text: formatCurrency(extrasTotal), color: textColor },
          { text: formatCurrency(total), color: textColor }
        ];
      }),
      ['', '', '', 
        formatCurrency(services.reduce((acc, service) => acc + Number(service.type?.price ?? 0), 0)),
        formatCurrency(services.reduce((acc, service) => 
          acc + (service.extrasByServices?.reduce((sum, extraByService) => 
            sum + Number(extraByService?.extra?.itemPrice ?? 0), 0) ?? 0), 0)),
        formatCurrency(services.reduce((acc, service) => {
          const typePrice = Number(service.type?.price ?? 0);
          const extrasTotal = service.extrasByServices?.reduce((sum, extraByService) => 
            sum + Number(extraByService?.extra?.itemPrice ?? 0), 0) ?? 0;
          return acc + typePrice + extrasTotal;
        }, 0)),
      ].map(cell => ({
        text: cell,
        fillColor: '#acb3c1'
      }))
    ];

    // Nueva tabla agrupada por tipo de servicio
    const typeTableBody = [
      ['Type', 'Date', 'Unit number', 'Type Price', 'Extras', 'Total'].map(header => ({
        text: header,
        fillColor: '#7b90be',
        color: '#ffffff'
      }))
    ];

    // Agregar servicios agrupados por tipo
    servicesByType.forEach((typeServices, typeName) => {
      // Agregar header de tipo
      typeTableBody.push([
        { text: typeName, fillColor: '#e6e6e6', color: '#000000' },
        { text: '', fillColor: '#e6e6e6', color: '#000000' },
        { text: '', fillColor: '#e6e6e6', color: '#000000' },
        { text: '', fillColor: '#e6e6e6', color: '#000000' },
        { text: '', fillColor: '#e6e6e6', color: '#000000' },
        { text: '', fillColor: '#e6e6e6', color: '#000000' }
      ]);

      // Agregar servicios de este tipo
      typeServices.forEach(service => {
        const isLeasingCenter = service.unitNumber?.toLowerCase() === 'leasing center';
        const textColor = isLeasingCenter ? '#ff0000' : null;
        
        const typePrice = Number(service.type?.price ?? 0);
        const extrasTotal = service.extrasByServices?.reduce((acc, extraByService) => 
          acc + Number(extraByService?.extra?.itemPrice ?? 0), 0) ?? 0;
        const total = typePrice + extrasTotal;
        
        typeTableBody.push([
          { text: '', color: textColor, fillColor: null },
          { text: moment(service.date).format('MM/DD/YYYY'), color: textColor, fillColor: null },
          { text: service.unitNumber ?? 'N/A', color: textColor, fillColor: null },
          { text: formatCurrency(typePrice), color: textColor, fillColor: null },
          { text: formatCurrency(extrasTotal), color: textColor, fillColor: null },
          { text: formatCurrency(total), color: textColor, fillColor: null }
        ]);
      });

      // Calcular totales para este tipo
      const typeTotalPrice = typeServices.reduce((acc, service) => acc + Number(service.type?.price ?? 0), 0);
      const typeTotalExtras = typeServices.reduce((acc, service) => 
        acc + (service.extrasByServices?.reduce((sum, extraByService) => 
          sum + Number(extraByService?.extra?.itemPrice ?? 0), 0) ?? 0), 0);
      const typeTotal = typeTotalPrice + typeTotalExtras;

      typeTableBody.push([
        { text: '', fillColor: '#acb3c1', color: null },
        { text: '', fillColor: '#acb3c1', color: null },
        { text: 'Total:', fillColor: '#acb3c1', color: null },
        { text: formatCurrency(typeTotalPrice), fillColor: '#acb3c1', color: null },
        { text: formatCurrency(typeTotalExtras), fillColor: '#acb3c1', color: null },
        { text: formatCurrency(typeTotal), fillColor: '#acb3c1', color: null }
      ]);
    });

    const community = await this.communityRepository.findOne({ where: { id: communityId } });

    const reportRangeLabel = hasRange
      ? `${parsedStart!.format('MM/DD/YYYY')} to ${parsedEnd!.format('MM/DD/YYYY')}`
      : `${currentYear}`;

    const docDefinition: TDocumentDefinitions = {
      styles,
      pageMargins: [40, 120, 40, 60],
      pageOrientation: 'landscape',
      pageSize: 'C3',
      header: {
        columns: [
          logo,
          {
            text: `Service Report - ${community?.communityName ?? 'Community'} - ${reportRangeLabel}`,
            style: 'header',
          },
          {
            fontSize: 10,
            text: today.format('LL'),
            italics: true,
            alignment: 'right',
            margin: [20, 20],
          }
        ],
      },
      content: [
        {
          text: 'Service Report',
          style: 'subheader',
          margin: [0, 10, 0, 10],
        },
        {
          table: {
            headerRows: 1,
            widths: ['*', '*', '*', '*', '*', '*'],
            body: tableBody
          }
        },
        {
          text: 'Reporte de Servicios por Tipo',
          style: 'subheader',
          margin: [0, 20, 0, 10],
        },
        {
          layout: 'customLayout01',
          table: {
            headerRows: 1,
            widths: ['*', '*', '*', '*', '*', '*'],
            body: typeTableBody
          }
        }
      ],
      footer: {
        text: `© ${moment().format('YYYY')} Services QPS. Este documento es confidencial y no puede ser compartido.`,
        style: 'footer',
      }
    };

    const doc = this.printerService.createPDF(docDefinition);

    doc.info.Title = `Service Report - ${community?.communityName ?? 'Community'} - ${reportRangeLabel}`;

    return doc;
  }

  private async getRecurringCosts(startOfWeek: string, endOfWeek: string) {
    return this.recurringCostsRepository
      .createQueryBuilder('recurring_costs')
      .where('recurring_costs.is_active = :isActive', { isActive: true })
      .andWhere('recurring_costs.start_date <= :endOfWeek', { endOfWeek })
      .andWhere('(recurring_costs.end_date IS NULL OR recurring_costs.end_date >= :startOfWeek)', { startOfWeek })
      .getMany();
  }

  private buildCleanerReportDocDefinition(
    cleanerName: string,
    services: ServicesEntity[],
    startOfWeek: string,
    endOfWeek: string,
    today: moment.Moment,
  ): TDocumentDefinitions {
    const formatCurrency = (value: number) =>
      new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(value);

    const servicesDashboard = services.map(service => {
      const totalExtrasByService = service.extrasByServices?.reduce((acc, extraByService) => {
        const commission = extraByService?.extra?.commission ?? 0;
        return acc + Number(commission);
      }, 0) ?? 0;

      const typeCommission = service.type?.commission ?? 0;
      const typePrice = service.type?.price ?? 0;

      const totalCleaner = Number(totalExtrasByService) + Number(typeCommission);
      const totalNotAdjusted = Number(typePrice) - Number(typeCommission) - Number(totalExtrasByService);

      const totalParner = totalNotAdjusted * 0.4;
      const total = totalNotAdjusted * 0.6;

      return {
        ...service,
        totalCleaner,
        totalParner,
        total,
      };
    });

    const totalCommission = servicesDashboard.reduce((acc, service) => acc + Number(service.type?.commission ?? 0), 0);
    const totalExtras = servicesDashboard.reduce((acc, service) =>
      acc + (service.extrasByServices?.reduce((sum, extraByService) =>
        sum + Number(extraByService?.extra?.commission ?? 0), 0) ?? 0), 0);
    const totalCleanerAmount = servicesDashboard.reduce((acc, service) => acc + Number(service.totalCleaner ?? 0), 0);

    const tableBody = [
      ['Date', 'Community', 'Unit number', 'Type', 'Commission', 'Extras', 'Total'],
      ...servicesDashboard.map(service => [
        moment(service.date).format('MM/DD/YYYY'),
        service.community?.communityName ?? 'N/A',
        service.unitNumber ?? 'N/A',
        'Total:',
        formatCurrency(Number(service.type?.commission ?? 0)),
        formatCurrency(service.extrasByServices?.reduce((acc, extraByService) => acc + Number(extraByService?.extra?.commission ?? 0), 0) ?? 0),
        formatCurrency(Number(service.totalCleaner ?? 0)),
      ]),
      [
        '',
        '',
        'Total: ',
        '',
        formatCurrency(totalCommission),
        formatCurrency(totalExtras),
        formatCurrency(totalCleanerAmount),
      ].map(cell => ({
        text: cell,
        fillColor: '#acb3c1',
        color: '#000000',
      })),
    ];

    return {
      styles,
      pageMargins: [40, 120, 40, 60],
      pageOrientation: 'landscape',
      pageSize: 'LETTER',
      header: (currentPage, pageCount) => ({
        columns: [
          logo,
          {
            text: `Cleaner Report - Week ${moment(startOfWeek).format('MM/DD/YYYY')} to ${moment(endOfWeek).format('MM/DD/YYYY')}`,
            style: 'header',
          },
          {
            fontSize: 10,
            text: `Page ${currentPage} of ${pageCount} - ${today.format('LL')}`,
            italics: true,
            alignment: 'right',
            margin: [20, 20],
          },
        ],
      }),
      content: [
        {
          text: `Cleaner: ${cleanerName}`,
          style: 'subheader',
          margin: [0, 10, 0, 10],
        },
        {
          layout: 'customLayout01',
          table: {
            headerRows: 1,
            widths: ['*', '*', '*', '*', '*', '*', '*'],
            body: tableBody,
          },
        },
      ],
      footer: (currentPage, pageCount) => ({
        text: `© ${moment().format('YYYY')} Services QPS. Este documento es confidencial y no puede ser compartido.`,
        style: 'footer',
        alignment: 'center',
        margin: [0, 10, 0, 0],
      }),
    };
  }

  private async buildCleanerReportBuffer(
    cleanerName: string,
    services: ServicesEntity[],
    startOfWeek: string,
    endOfWeek: string,
    today: moment.Moment,
  ) {
    const docDefinition = this.buildCleanerReportDocDefinition(
      cleanerName,
      services,
      startOfWeek,
      endOfWeek,
      today,
    );
    const doc = this.printerService.createPDF(docDefinition);
    doc.info.Title = `Cleaner Report - ${cleanerName} - ${startOfWeek} to ${endOfWeek}`;
    const buffer = await this.collectPdfBuffer(doc);
    const fileName = `${this.sanitizeFileName(cleanerName)}-${startOfWeek}-to-${endOfWeek}.pdf`;

    return { fileName, buffer };
  }

  private sanitizeFileName(value: string) {
    const normalized = value
      .normalize('NFKD')
      .replace(/[^a-zA-Z0-9-_ ]/g, '')
      .trim();
    const compact = normalized.replace(/\s+/g, '_');
    return compact.length > 0 ? compact : 'cleaner';
  }

  private collectPdfBuffer(doc: PDFKit.PDFDocument): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];
      doc.on('data', chunk => chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk)));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);
      doc.end();
    });
  }

  private getPreviousWeekRange() {
    const startOfWeek = moment().startOf('isoWeek').subtract(7, 'days').format('YYYY-MM-DD');
    const endOfWeek = moment().endOf('isoWeek').subtract(7, 'days').format('YYYY-MM-DD');
    return { startOfWeek, endOfWeek };
  }

  private async createCleanerReportLink(userId: string, startDate: string, endDate: string) {
    const token = randomUUID();
    const expiresAt = moment().add(7, 'days').toDate();

    await this.cleanerReportLinksRepository.save({
      id: token,
      userId,
      startDate,
      endDate,
      expiresAt,
    });

    const baseUrl = (envVars.REPORTS_PUBLIC_BASE_URL || '').replace(/\/$/, '');
    return `${baseUrl}/reports/cleaner/${token}`;
  }

  async reportByCleanerToken(token: string): Promise<{ fileName: string; buffer: Buffer } | null> {
    const link = await this.cleanerReportLinksRepository.findOne({
      where: { id: token },
    });
    if (!link) {
      return null;
    }

    if (moment(link.expiresAt).isBefore(moment())) {
      return null;
    }

    const cleaner = await this.usersRepository.findOne({
      where: { id: link.userId },
      select: ['id', 'name'],
    });
    if (!cleaner) {
      return null;
    }

    const services = await this.servicesRepository
      .createQueryBuilder('services')
      .leftJoinAndSelect('services.community', 'community')
      .leftJoinAndSelect('services.type', 'type')
      .leftJoinAndSelect('services.status', 'status')
      .leftJoinAndSelect('services.user', 'user')
      .leftJoinAndSelect('services.extrasByServices', 'extrasByServices')
      .leftJoinAndSelect('extrasByServices.extra', 'extra')
      .where('services.userId = :userId', { userId: link.userId })
      .andWhere('services.date BETWEEN :startDate AND :endDate', {
        startDate: link.startDate,
        endDate: link.endDate,
      })
      .getMany();

    const today = moment();
    const cleanerName = cleaner.name || 'Cleaner';
    const result = await this.buildCleanerReportBuffer(
      cleanerName,
      services,
      link.startDate,
      link.endDate,
      today,
    );

    return {
      fileName: result.fileName,
      buffer: result.buffer,
    };
  }
}
