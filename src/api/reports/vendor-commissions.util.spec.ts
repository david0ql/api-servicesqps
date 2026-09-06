import {
  calcularComisionesVendedores,
  gananciaDelServicio,
  totalComisiones,
  TASA_COMISION_POR_DEFECTO,
} from './vendor-commissions.util';
import { ServicesEntity } from '../../entities/services.entity';

const servicio = (opciones: {
  fecha?: string;
  precio?: number;
  comision?: number;
  extras?: { precio: number; comision: number }[];
  comunidad?: {
    id?: string;
    nombre?: string;
    vendorUserId?: string | null;
    vendorNombre?: string;
    desde?: string | null;
    tasa?: number | null;
  } | null;
}): ServicesEntity => ({
  date: opciones.fecha ?? '2026-09-10',
  type: { price: opciones.precio ?? 0, commission: opciones.comision ?? 0 },
  extrasByServices: (opciones.extras ?? []).map((e) => ({
    extra: { itemPrice: e.precio, commission: e.comision },
  })),
  community: opciones.comunidad === null ? null : {
    id: opciones.comunidad?.id ?? '41',
    communityName: opciones.comunidad?.nombre ?? 'Alton Serenoa',
    vendorUserId: opciones.comunidad?.vendorUserId === undefined ? '220' : opciones.comunidad.vendorUserId,
    vendorAssignedAt: opciones.comunidad?.desde === undefined ? null : opciones.comunidad.desde,
    vendorCommissionRate: opciones.comunidad?.tasa === undefined ? null : opciones.comunidad.tasa,
    vendorUser: { name: opciones.comunidad?.vendorNombre ?? 'Diego Pinto' },
  },
} as unknown as ServicesEntity);

describe('gananciaDelServicio', () => {
  it('resta la comision de la cleaner al precio cobrado', () => {
    expect(gananciaDelServicio(servicio({ precio: 155, comision: 90 }))).toBe(65);
  });

  it('incluye los extras en los dos lados', () => {
    const s = servicio({ precio: 155, comision: 90, extras: [{ precio: 40, comision: 20 }] });
    expect(gananciaDelServicio(s)).toBe(85); // (155+40) - (90+20)
  });

  it('no explota con datos faltantes', () => {
    expect(gananciaDelServicio({} as ServicesEntity)).toBe(0);
  });
});

describe('calcularComisionesVendedores', () => {
  it('aplica el 10% por defecto sobre la ganancia, no sobre la facturacion', () => {
    // Caso real de Alton Serenoa: facturado 2035, comisiones 965 -> base 1070
    const servicios = [servicio({ precio: 2035, comision: 965 })];
    const [vendedor] = calcularComisionesVendedores(servicios);

    expect(vendedor.base).toBe(1070);
    expect(vendedor.comision).toBe(107); // y NO 203.50, que seria sobre la facturacion
  });

  it('ignora los complex sin vendedor asignado', () => {
    const servicios = [
      servicio({ precio: 100, comision: 40, comunidad: { vendorUserId: null } }),
      servicio({ precio: 100, comision: 40 }),
    ];
    const resultado = calcularComisionesVendedores(servicios);
    expect(resultado).toHaveLength(1);
    expect(resultado[0].base).toBe(60);
  });

  it('no cobra por servicios anteriores a la fecha en que se asigno el vendedor', () => {
    const servicios = [
      servicio({ fecha: '2026-08-01', precio: 100, comision: 40, comunidad: { desde: '2026-09-01' } }),
      servicio({ fecha: '2026-09-05', precio: 100, comision: 40, comunidad: { desde: '2026-09-01' } }),
    ];
    const [vendedor] = calcularComisionesVendedores(servicios);
    expect(vendedor.base).toBe(60); // solo el de septiembre
  });

  it('cuenta el servicio del mismo dia en que se asigno', () => {
    const servicios = [servicio({ fecha: '2026-09-01', precio: 100, comision: 40, comunidad: { desde: '2026-09-01' } })];
    expect(calcularComisionesVendedores(servicios)[0].base).toBe(60);
  });

  it('respeta una tasa distinta pactada con un vendedor', () => {
    const servicios = [servicio({ precio: 1000, comision: 0, comunidad: { tasa: 0.15 } })];
    expect(calcularComisionesVendedores(servicios)[0].comision).toBe(150);
  });

  it('agrupa por vendedor y desglosa por complex', () => {
    const servicios = [
      servicio({ precio: 200, comision: 100, comunidad: { id: '1', nombre: 'Kestra' } }),
      servicio({ precio: 300, comision: 100, comunidad: { id: '2', nombre: 'Urbana' } }),
      servicio({ precio: 100, comision: 50, comunidad: { id: '3', nombre: 'Zen', vendorUserId: '221', vendorNombre: 'Felix Estevez' } }),
    ];
    const resultado = calcularComisionesVendedores(servicios);

    expect(resultado).toHaveLength(2);
    const diego = resultado.find((v) => v.vendorName === 'Diego Pinto')!;
    expect(diego.base).toBe(300);          // 100 + 200
    expect(diego.comision).toBe(30);
    expect(diego.complexes.map((c) => c.communityName).sort()).toEqual(['Kestra', 'Urbana']);
  });

  it('la suma de los complex cuadra con el total del vendedor', () => {
    const servicios = [
      servicio({ precio: 155.55, comision: 90.05, comunidad: { id: '1' } }),
      servicio({ precio: 110.11, comision: 50.07, comunidad: { id: '2' } }),
      servicio({ precio: 99.99, comision: 33.33, comunidad: { id: '3' } }),
    ];
    const [vendedor] = calcularComisionesVendedores(servicios);
    const suma = vendedor.complexes.reduce((s, c) => s + c.comision, 0);
    expect(Math.round(suma * 100) / 100).toBe(vendedor.comision);
  });

  it('sin servicios devuelve lista vacia y total cero', () => {
    expect(calcularComisionesVendedores([])).toEqual([]);
    expect(totalComisiones([])).toBe(0);
  });

  it('la tasa por defecto es 10%', () => {
    expect(TASA_COMISION_POR_DEFECTO).toBe(0.10);
  });
});
