import { TypeOrmModule } from '@nestjs/typeorm';
import { Module } from '@nestjs/common';

import { CommunitiesModule } from './api/communities/communities.module';
import { CompaniesModule } from './api/companies/companies.module';
import { ServicesModule } from './api/services/services.module';
import { CalendarModule } from './api/calendar/calendar.module';
import { StatusesModule } from './api/statuses/statuses.module';
import { ExtrasModule } from './api/extras/extras.module';
import { TypesModule } from './api/types/types.module';
import { UsersModule } from './api/users/users.module';
import { CostsModule } from './api/costs/costs.module';
import { RecurringCostsModule } from './api/recurring-costs/recurring-costs.module';
import { AuthModule } from './api/auth/auth.module';
import { ReportsModule } from './api/reports/reports.module';
import { PrinterModule } from './printer/printer.module';
import { PermissionsModule } from './api/permissions/permissions.module';
import { ReviewsModule } from './api/reviews/reviews.module';

import envVars from './config/env';

@Module({
  imports: [
    TypeOrmModule.forRoot({
      type: "mysql",
      host: envVars.DB_HOST,
      port: envVars.DB_PORT,
      username: envVars.DB_USERNAME,
      password: envVars.DB_PASSWORD,
      database: envVars.DB_DATABASE,
      entities: [__dirname + '/entities/*.entity{.ts,.js}'],
      synchronize: true,
      autoLoadEntities: true,
    }),

    AuthModule,
    ServicesModule,
    UsersModule,
    CompaniesModule,
    CommunitiesModule,
    CostsModule,
    RecurringCostsModule,
    ExtrasModule,
    StatusesModule,
    TypesModule,
    CalendarModule,
    ReportsModule,
    PrinterModule,
    PermissionsModule,
    ReviewsModule,
  ],
  controllers: [],
  providers: [],
})

export class AppModule { }
