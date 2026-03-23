# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
# Development
npm run start:dev       # Start with hot reload
npm run start:debug     # Start with debugging

# Build
npm run build           # Compile TypeScript

# Code Quality
npm run lint            # ESLint with auto-fix
npm run format          # Prettier formatting

# Testing
npm run test                                        # Run all unit tests
npm run test -- services.service.spec.ts            # Run a single test file
npm run test -- --testNamePattern="pattern"         # Run tests by name
npm run test:watch                                  # Watch mode
npm run test:cov                                    # Coverage report
npm run test:e2e                                    # End-to-end tests
```

## Architecture

This is a **NestJS** REST API for managing field services (cleaning/maintenance): scheduling, worker assignment, GPS tracking, reviews, costs, and PDF report generation.

### Module Structure

All feature modules live in `src/api/`, each following the NestJS module pattern (controller → service → repository → entity):

- **auth** — JWT/Passport authentication
- **services** — Core domain: service CRUD, lifecycle (pending → in-progress → completed), location tracking
- **recurring-services** — Scheduled repeating services with day-of-week configuration
- **users** — User management with role-based access
- **communities** — Property/building management
- **companies** — Business entity management
- **costs / recurring-costs** — Financial tracking per service
- **extras** — Additional charges attached to services
- **reviews** — Quality assessment linked to services
- **reports** — Tenant-aware PDF report generation (PDFMake)
- **service-chat** — Real-time messaging (Socket.io) per service
- **calendar** — Scheduling/calendar views
- **statuses / types / permissions** — Reference data and RBAC

Shared entities are in `src/entities/`. Common pagination types (`PageDto<T>`, `PageOptionsDto`, `PageMetaDto`) are in `src/common/`.

### Key Patterns

- **TypeORM + QueryBuilder**: Complex list queries use QueryBuilder for dynamic filtering and pagination. Simple lookups use the repository API.
- **DTO validation**: All request bodies use `class-validator` decorated DTOs; responses use mapped DTOs.
- **Pagination**: All list endpoints follow the `PageDto<T>` pattern with `PageOptionsDto` (page, take, order).
- **Multi-tenancy**: `src/config/tenant-config.ts` branches behavior (report layouts, shareholder models) by `TENANT_ID` env var.
- **Custom decorators**: `@ManyToOneNoAction` enforces SET NULL cascade on delete; `@ApiPaginatedResponse` documents paginated Swagger responses.
- **Scheduled jobs**: Background tasks use `@Cron()` from `@nestjs/schedule`.

### Database

MySQL via TypeORM with `synchronize: true` (schema auto-syncs on startup). Connection configured in `src/app.module.ts` from env vars.

### Environment Variables

Copy `.env.template` to `.env`. Key variables:

```
DB_HOST, DB_PORT, DB_DATABASE, DB_USERNAME, DB_PASSWORD
JWT_SECRET
PORT=3000
TENANT_ID=main|ventpro|servicesqps
ENABLE_NOTIFICATIONS=false|true
ENABLE_SMS=false|true
EXPO_ACCESS_TOKEN          # Push notifications
TEXTBEE_API_KEY, TEXTBEE_DEVICE_ID   # SMS gateway
REPORTS_PUBLIC_BASE_URL    # Base URL for generated report links
```

### API Docs

Swagger UI available at `/docs` when running locally.
