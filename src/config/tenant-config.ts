export interface FixedShareholderConfig {
  name: string;
  percentage: number;
}

export interface PayoutReserveSplitConfig {
  paymentRatio: number;
  reserveRatio: number;
}

interface TenantReportsConfig {
  logoPath: string;
  shareholderModel: 'main-dynamic' | 'fixed';
  fixedShareholders?: FixedShareholderConfig[];
  payoutReserveSplit?: PayoutReserveSplitConfig;
  netProfitColumnLabel?: string;
}

export interface TenantConfig {
  id: string;
  reports: TenantReportsConfig;
}

const MAIN_TENANT_CONFIG: TenantConfig = {
  id: 'main',
  reports: {
    logoPath: 'src/assets/brands/main/logo.png',
    shareholderModel: 'main-dynamic',
  },
};

const VENTPRO_TENANT_CONFIG: TenantConfig = {
  id: 'ventpro',
  reports: {
    logoPath: 'src/assets/brands/ventpro/logo.png',
    shareholderModel: 'fixed',
    fixedShareholders: [
      { name: 'Accionista 1', percentage: 0.3333 },
      { name: 'Accionista 2', percentage: 0.3333 },
      { name: 'Accionista 3', percentage: 0.3334 },
    ],
    payoutReserveSplit: {
      paymentRatio: 0.6,
      reserveRatio: 0.4,
    },
    netProfitColumnLabel: 'Ganancia Neta (33.33%)',
  },
};

const TENANT_CONFIGS: Record<string, TenantConfig> = {
  main: MAIN_TENANT_CONFIG,
  servicesqps: MAIN_TENANT_CONFIG,
  default: MAIN_TENANT_CONFIG,
  ventpro: VENTPRO_TENANT_CONFIG,
};

export function getTenantConfig(rawTenantId?: string): TenantConfig {
  const tenantId = String(rawTenantId || 'main').trim().toLowerCase();
  return TENANT_CONFIGS[tenantId] ?? MAIN_TENANT_CONFIG;
}
