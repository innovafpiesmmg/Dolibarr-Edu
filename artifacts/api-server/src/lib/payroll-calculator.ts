export interface PayrollInputData {
  employeeId: number;
  studentId: number;
  periodMonth: number;
  periodYear: number;
  salaryBase: number;
  extraPayments: number;
  contractType: "indefinido" | "temporal";
  irpfRate: number;
  plusConvenio?: number;
  plusTransporte?: number;
  importeHorasExtra?: number;
  otroDevengo?: number;
  otroDevengoLabel?: string | null;
  irpfRateOverride?: number;
}

export interface PayrollResult {
  employeeId: number;
  studentId: number;
  periodMonth: number;
  periodYear: number;
  salaryBase: number;
  plusConvenio: number;
  plusTransporte: number;
  importeHorasExtra: number;
  otroDevengo: number;
  otroDevengoLabel: string | null;
  prorataPagasExtra: number;
  totalDevengos: number;
  baseCotizacion: number;
  ssContingencias: number;
  ssDesempleo: number;
  ssFp: number;
  totalSsTrabajador: number;
  irpfRate: number;
  irpfAmount: number;
  totalDeducciones: number;
  liquidoPercibir: number;
  ssEmpresaContingencias: number;
  ssEmpresaDesempleo: number;
  ssEmpresaFp: number;
  ssEmpresaFogasa: number;
  totalSsEmpresa: number;
  totalCosteEmpresa: number;
}

const r2 = (n: number) => Math.round(n * 100) / 100;

export function calculatePayroll(input: PayrollInputData): PayrollResult {
  const {
    employeeId,
    studentId,
    periodMonth,
    periodYear,
    salaryBase,
    extraPayments,
    contractType,
    plusConvenio = 0,
    plusTransporte = 0,
    importeHorasExtra = 0,
    otroDevengo = 0,
    otroDevengoLabel = null,
    irpfRateOverride,
  } = input;

  const irpfRate = irpfRateOverride !== undefined ? irpfRateOverride : input.irpfRate;

  const prorataPagasExtra = extraPayments === 14 ? r2((salaryBase * 2) / 12) : 0;

  const totalDevengos = r2(
    salaryBase + plusConvenio + plusTransporte + importeHorasExtra + otroDevengo + prorataPagasExtra,
  );

  const baseCotizacion = totalDevengos;

  // SS Trabajador — tarifas 2024
  const ssContingencias = r2(baseCotizacion * 0.047);
  const ssDesempleo = r2(baseCotizacion * (contractType === "indefinido" ? 0.0155 : 0.016));
  const ssFp = r2(baseCotizacion * 0.001);
  const totalSsTrabajador = r2(ssContingencias + ssDesempleo + ssFp);

  // IRPF
  const irpfAmount = r2(baseCotizacion * (irpfRate / 100));

  const totalDeducciones = r2(totalSsTrabajador + irpfAmount);
  const liquidoPercibir = r2(totalDevengos - totalDeducciones);

  // SS Empresa — tarifas 2024
  const ssEmpresaContingencias = r2(baseCotizacion * 0.236);
  const ssEmpresaDesempleo = r2(baseCotizacion * (contractType === "indefinido" ? 0.055 : 0.067));
  const ssEmpresaFp = r2(baseCotizacion * 0.006);
  const ssEmpresaFogasa = r2(baseCotizacion * 0.002);
  const totalSsEmpresa = r2(ssEmpresaContingencias + ssEmpresaDesempleo + ssEmpresaFp + ssEmpresaFogasa);
  const totalCosteEmpresa = r2(totalDevengos + totalSsEmpresa);

  return {
    employeeId,
    studentId,
    periodMonth,
    periodYear,
    salaryBase,
    plusConvenio,
    plusTransporte,
    importeHorasExtra,
    otroDevengo,
    otroDevengoLabel: otroDevengoLabel ?? null,
    prorataPagasExtra,
    totalDevengos,
    baseCotizacion,
    ssContingencias,
    ssDesempleo,
    ssFp,
    totalSsTrabajador,
    irpfRate,
    irpfAmount,
    totalDeducciones,
    liquidoPercibir,
    ssEmpresaContingencias,
    ssEmpresaDesempleo,
    ssEmpresaFp,
    ssEmpresaFogasa,
    totalSsEmpresa,
    totalCosteEmpresa,
  };
}
