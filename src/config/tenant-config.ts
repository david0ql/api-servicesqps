export interface FixedShareholderConfig {
  name: string;
  percentage: number;
}

export interface PayoutReserveSplitConfig {
  paymentRatio: number;
  reserveRatio: number;
}

/**
 * Vendedor global: gana `rate` de lo facturado (servicios + extras) de TODOS los
 * complex, sin tener complex asignados, para servicios con fecha >= `from`.
 */
export interface GlobalVendorConfig {
  vendorUserId: string;
  rate: number;
  from: string;
}

interface TenantReportsConfig {
  logoPath: string;
  shareholderModel: 'main-dynamic' | 'fixed';
  fixedShareholders?: FixedShareholderConfig[];
  payoutReserveSplit?: PayoutReserveSplitConfig;
  netProfitColumnLabel?: string;
  globalVendors?: GlobalVendorConfig[];
  /** Tasa por vendedor (userId -> tasa) cuando el complex no trae una propia. Default 10%. */
  vendorRates?: Record<string, number>;
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
    // Diego Pinto (Vendedor, user 249): 20% de lo facturado, solo de los complex
    // que tenga asignados como vendedor. Reemplaza el 20% como accionista.
    vendorRates: { '249': 0.20 },
  },
};

const VENTPRO_TENANT_CONFIG: TenantConfig = {
  id: 'ventpro',
  reports: {
    logoPath: 'src/assets/brands/ventpro/logo.png',
    shareholderModel: 'fixed',
    fixedShareholders: [
      { name: 'Diego Pinto', percentage: 0.3333 },
      { name: 'Felix Estevez', percentage: 0.3333 },
      { name: 'Felix Mendoza', percentage: 0.3334 },
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
