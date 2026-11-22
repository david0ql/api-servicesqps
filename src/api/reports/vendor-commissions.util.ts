import moment from 'moment-timezone';

import { ServicesEntity } from '../../entities/services.entity';

/**
 * Comisiones de los vendedores asociados (brokers).
 *
 * Base de calculo, corregida por Felix el 02/10/2026:
 *   "debe ser tomado el 10% del service price + 10% del extra price"
 *
 *   base = precio de servicios + precio de extras
 *
 * Es decir, sobre lo FACTURADO al complex, sin descontar lo que se le paga a
 * la cleaner ni los gastos generales. El 05/09/2026 se habia confirmado lo
 * contrario (sobre el neto despues de cleaners); quedo descartado.
 *
 * La comision solo cuenta desde que al complex se le asigno el vendedor
 * (vendorAssignedAt): los reportes de semanas anteriores salen como siempre.
 */

export const TASA_COMISION_POR_DEFECTO = 0.10;

export interface ComisionPorComplex {
  communityId: string;
  communityName: string;
  base: number;
  tasa: number;
  comision: number;
}

export interface ComisionVendedor {
  vendorUserId: string;
  vendorName: string;
  base: number;
  comision: number;
  complexes: ComisionPorComplex[];
}

const numero = (valor: unknown): number => {
  const n = Number(valor ?? 0);
  return Number.isFinite(n) ? n : 0;
};

/** Lo facturado por un servicio: precio del servicio + precio de sus extras. */
export function facturadoDelServicio(service: ServicesEntity): number {
  const precioServicio = numero(service.type?.price);

  const extras = service.extrasByServices ?? [];
  const precioExtras = extras.reduce((suma, e) => suma + numero(e?.extra?.itemPrice), 0);

  return precioServicio + precioExtras;
}

/**
 * Agrupa por vendedor las comisiones de los servicios del periodo.
 * Solo entran los complex que tienen vendedor asignado y cuya fecha de
 * asignacion es anterior o igual a la fecha del servicio.
 */
export function calcularComisionesVendedores(services: ServicesEntity[]): ComisionVendedor[] {
  const porVendedor = new Map<string, ComisionVendedor>();

  for (const service of services) {
    const community = service.community;
    const vendorId = community?.vendorUserId;
    if (!community || !vendorId) continue;

    // La comision aplica desde que se le asigno el vendedor al complex.
    if (community.vendorAssignedAt) {
      const desde = moment.utc(community.vendorAssignedAt, 'YYYY-MM-DD', true);
      const fechaServicio = moment.utc(service.date);
      if (desde.isValid() && fechaServicio.isValid() && fechaServicio.isBefore(desde, 'day')) {
        continue;
      }
    }

    const tasa = community.vendorCommissionRate != null
      ? numero(community.vendorCommissionRate)
      : TASA_COMISION_POR_DEFECTO;

    const facturado = facturadoDelServicio(service);

    if (!porVendedor.has(vendorId)) {
      porVendedor.set(vendorId, {
        vendorUserId: vendorId,
        vendorName: community.vendorUser?.name ?? 'Vendedor',
        base: 0,
        comision: 0,
        complexes: [],
      });
    }

    const vendedor = porVendedor.get(vendorId)!;
    let complex = vendedor.complexes.find((c) => c.communityId === community.id);
    if (!complex) {
      complex = {
        communityId: community.id,
        communityName: community.communityName ?? 'Sin nombre',
        base: 0,
        tasa,
        comision: 0,
      };
      vendedor.complexes.push(complex);
    }

    complex.base += facturado;
    vendedor.base += facturado;
  }

  // El redondeo se hace UNA sola vez, sobre el total de cada complex, para que
  // la suma de los complex cuadre con el total del vendedor.
  for (const vendedor of porVendedor.values()) {
    vendedor.comision = 0;
    for (const complex of vendedor.complexes) {
      complex.base = redondear(complex.base);
      complex.comision = redondear(complex.base * complex.tasa);
      vendedor.comision += complex.comision;
    }
    vendedor.base = redondear(vendedor.base);
    vendedor.comision = redondear(vendedor.comision);
    vendedor.complexes.sort((a, b) => b.comision - a.comision);
  }

  return [...porVendedor.values()].sort((a, b) => b.comision - a.comision);
}

export function totalComisiones(comisiones: ComisionVendedor[]): number {
  return redondear(comisiones.reduce((suma, v) => suma + v.comision, 0));
}

function redondear(valor: number): number {
  return Math.round((valor + Number.EPSILON) * 100) / 100;
}
