import { useParams, Link } from "wouter";
import { useGetPayroll, useGetEmployee } from "@workspace/api-client-react";
import { ArrowLeft, Building2, Banknote, CheckCircle2, AlertCircle, Clock, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { format } from "date-fns";
import { es } from "date-fns/locale";

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const fmt = (n: number) => n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
const fmtPct = (n: number) => n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " %";

function SyncBadge({ status, error }: { status: string; error?: string | null }) {
  if (status === "synced") return (
    <Badge className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20">
      <CheckCircle2 className="h-3 w-3 mr-1" /> Sincronizado con Dolibarr
    </Badge>
  );
  if (status === "error") return (
    <div className="space-y-1">
      <Badge variant="destructive" className="bg-red-500/10 text-red-700 border-red-500/20">
        <AlertCircle className="h-3 w-3 mr-1" /> Error sync
      </Badge>
      {error && <p className="text-xs text-red-600 max-w-xs">{error}</p>}
    </div>
  );
  return (
    <Badge variant="outline" className="text-yellow-700 border-yellow-400/40 bg-yellow-500/10">
      <Clock className="h-3 w-3 mr-1" /> Pendiente de sync
    </Badge>
  );
}

export default function NominaDetalle() {
  const params = useParams();
  const id = Number(params.id);

  const { data: payroll, isLoading } = useGetPayroll(id, { query: { enabled: !!id, queryKey: ["getPayroll", id] } });
  const { data: employee } = useGetEmployee(payroll?.employeeId ?? 0, {
    query: { enabled: !!payroll?.employeeId, queryKey: ["getEmployee", payroll?.employeeId] },
  });

  if (isLoading) {
    return (
      <div className="space-y-6 max-w-3xl">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-[600px] w-full" />
      </div>
    );
  }

  if (!payroll) return <div>Nómina no encontrada</div>;

  return (
    <div className="space-y-6 max-w-3xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/nominas"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              Nómina — {MONTHS[(payroll.periodMonth ?? 1) - 1]} {payroll.periodYear}
            </h1>
            {employee && (
              <p className="text-muted-foreground text-sm">
                {employee.firstName} {employee.lastName} · {employee.jobTitle}
              </p>
            )}
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Printer className="mr-2 h-4 w-4" /> Imprimir
        </Button>
      </div>

      {/* Estado Dolibarr */}
      <div className="flex items-center gap-4 p-4 rounded-lg border bg-card">
        <div className="flex-1 space-y-1">
          <div className="text-sm font-medium">Estado en Dolibarr ERP</div>
          <SyncBadge status={payroll.dolibarrSyncStatus ?? "pending"} error={payroll.dolibarrSyncError} />
        </div>
        {payroll.dolibarrSalaryId && (
          <div className="text-right text-sm">
            <div className="text-muted-foreground">ID Salario ERP</div>
            <div className="font-mono font-bold">#{payroll.dolibarrSalaryId}</div>
          </div>
        )}
        {payroll.dolibarrAccountingId && (
          <div className="text-right text-sm">
            <div className="text-muted-foreground">ID Asiento ERP</div>
            <div className="font-mono font-bold">#{payroll.dolibarrAccountingId}</div>
          </div>
        )}
      </div>

      <Card className="border-primary/20 print:shadow-none print:border">
        <CardHeader className="bg-primary/5 rounded-t-lg print:bg-white">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Banknote className="h-5 w-5 text-primary" />
                Recibo de Salario
              </CardTitle>
              <p className="text-sm text-muted-foreground mt-1">
                Período: {MONTHS[(payroll.periodMonth ?? 1) - 1]} {payroll.periodYear}
              </p>
            </div>
            <div className="text-right text-sm">
              <div className="text-muted-foreground">Generado el</div>
              <div>{format(new Date(payroll.createdAt), "d MMM yyyy", { locale: es })}</div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="pt-6 space-y-5">
          {/* Devengos */}
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Devengos</div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Salario base</span>
                <span className="font-mono">{fmt(payroll.salaryBase)}</span>
              </div>
              {payroll.plusConvenio > 0 && (
                <div className="flex justify-between">
                  <span>Plus de convenio</span>
                  <span className="font-mono">{fmt(payroll.plusConvenio)}</span>
                </div>
              )}
              {payroll.plusTransporte > 0 && (
                <div className="flex justify-between">
                  <span>Plus de transporte</span>
                  <span className="font-mono">{fmt(payroll.plusTransporte)}</span>
                </div>
              )}
              {payroll.importeHorasExtra > 0 && (
                <div className="flex justify-between">
                  <span>Horas extraordinarias</span>
                  <span className="font-mono">{fmt(payroll.importeHorasExtra)}</span>
                </div>
              )}
              {payroll.otroDevengo > 0 && (
                <div className="flex justify-between">
                  <span>{payroll.otroDevengoLabel ?? "Otros devengos"}</span>
                  <span className="font-mono">{fmt(payroll.otroDevengo)}</span>
                </div>
              )}
              {payroll.prorataPagasExtra > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Prorrata pagas extra</span>
                  <span className="font-mono">{fmt(payroll.prorataPagasExtra)}</span>
                </div>
              )}
              <div className="flex justify-between font-semibold border-t pt-2 mt-1">
                <span>Total devengos</span>
                <span className="font-mono">{fmt(payroll.totalDevengos)}</span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Deducciones */}
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Deducciones</div>
            <div className="space-y-2 text-sm">
              <div className="text-xs font-medium text-muted-foreground mb-1">Seguridad Social (trabajador)</div>
              <div className="flex justify-between text-orange-700 dark:text-orange-400 pl-3">
                <span>Contingencias Comunes (4,70%)</span>
                <span className="font-mono">-{fmt(payroll.ssContingencias)}</span>
              </div>
              <div className="flex justify-between text-orange-700 dark:text-orange-400 pl-3">
                <span>Desempleo</span>
                <span className="font-mono">-{fmt(payroll.ssDesempleo)}</span>
              </div>
              <div className="flex justify-between text-orange-700 dark:text-orange-400 pl-3">
                <span>Formación Profesional (0,10%)</span>
                <span className="font-mono">-{fmt(payroll.ssFp)}</span>
              </div>
              <div className="flex justify-between text-orange-700 dark:text-orange-400 font-medium pl-3 border-b pb-2">
                <span>Total SS trabajador</span>
                <span className="font-mono">-{fmt(payroll.totalSsTrabajador)}</span>
              </div>
              <div className="flex justify-between text-red-700 dark:text-red-400 mt-2">
                <span>Retención IRPF ({fmtPct(payroll.irpfRate)})</span>
                <span className="font-mono">-{fmt(payroll.irpfAmount)}</span>
              </div>
              <div className="flex justify-between font-semibold border-t pt-2 mt-1">
                <span>Total deducciones</span>
                <span className="font-mono text-destructive">-{fmt(payroll.totalDeducciones)}</span>
              </div>
            </div>
          </div>

          <Separator />

          <div className="flex justify-between text-xl font-bold bg-green-500/10 text-green-700 dark:text-green-300 p-4 rounded-lg border border-green-500/20">
            <span>Líquido a percibir</span>
            <span className="font-mono">{fmt(payroll.liquidoPercibir)}</span>
          </div>

          <Separator />

          {/* Coste empresa */}
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3">Cuota empresarial SS</div>
            <div className="space-y-2 text-sm text-muted-foreground">
              <div className="flex justify-between">
                <span>Contingencias Comunes (23,60%)</span>
                <span className="font-mono">{fmt(payroll.ssEmpresaContingencias)}</span>
              </div>
              <div className="flex justify-between">
                <span>Desempleo</span>
                <span className="font-mono">{fmt(payroll.ssEmpresaDesempleo)}</span>
              </div>
              <div className="flex justify-between">
                <span>Formación Profesional (0,60%)</span>
                <span className="font-mono">{fmt(payroll.ssEmpresaFp)}</span>
              </div>
              <div className="flex justify-between">
                <span>FOGASA (0,20%)</span>
                <span className="font-mono">{fmt(payroll.ssEmpresaFogasa)}</span>
              </div>
              <div className="flex justify-between font-semibold text-foreground border-t pt-2">
                <span>Total SS empresa</span>
                <span className="font-mono">{fmt(payroll.totalSsEmpresa)}</span>
              </div>
              <div className="flex justify-between font-bold text-foreground text-base pt-1">
                <span>Coste total empresa</span>
                <span className="font-mono">{fmt(payroll.totalCosteEmpresa)}</span>
              </div>
            </div>
          </div>

          <Separator />

          {/* Apunte contable */}
          <div>
            <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-3 flex items-center gap-1">
              <Building2 className="h-3.5 w-3.5" /> Asiento contable (PGC)
            </div>
            <div className="text-xs font-mono bg-muted/40 rounded p-3 space-y-1">
              <div className="grid grid-cols-3 gap-2 text-muted-foreground font-sans font-medium mb-2">
                <span>Cuenta</span><span className="text-right">Debe</span><span className="text-right">Haber</span>
              </div>
              <div className="grid grid-cols-3 gap-2"><span>640 Sueldos y salarios</span><span className="text-right">{fmt(payroll.totalDevengos)}</span><span></span></div>
              <div className="grid grid-cols-3 gap-2"><span>642 SS a cargo empresa</span><span className="text-right">{fmt(payroll.totalSsEmpresa)}</span><span></span></div>
              <div className="grid grid-cols-3 gap-2"><span>465 Rem. pendientes pago</span><span></span><span className="text-right">{fmt(payroll.liquidoPercibir)}</span></div>
              <div className="grid grid-cols-3 gap-2"><span>476 Organismos SS acr.</span><span></span><span className="text-right">{fmt(payroll.totalSsTrabajador + payroll.totalSsEmpresa)}</span></div>
              <div className="grid grid-cols-3 gap-2"><span>4751 HP acr. IRPF</span><span></span><span className="text-right">{fmt(payroll.irpfAmount)}</span></div>
              <div className="grid grid-cols-3 gap-2 font-semibold border-t pt-1 mt-1 font-sans">
                <span>TOTAL</span>
                <span className="text-right font-mono">{fmt(payroll.totalDevengos + payroll.totalSsEmpresa)}</span>
                <span className="text-right font-mono">{fmt(payroll.totalDevengos + payroll.totalSsEmpresa)}</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
