import { useState } from "react";
import { Link } from "wouter";
import {
  useGetSSSummary,
  usePaySSLiquidacion,
  usePayIRPFLiquidacion,
  useListStudents,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft, Building2, CheckCircle2, Clock, AlertCircle,
  BadgeEuro, Landmark, Receipt, ArrowRight, RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const fmt = (n: number) =>
  n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";

const now = new Date();

function StatusBadge({ status, label }: { status: string; label: string }) {
  if (status === "paid") return (
    <Badge className="bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/20 gap-1">
      <CheckCircle2 className="h-3 w-3" /> {label} — Pagado
    </Badge>
  );
  if (status === "error") return (
    <Badge variant="destructive" className="gap-1">
      <AlertCircle className="h-3 w-3" /> {label} — Error
    </Badge>
  );
  return (
    <Badge variant="outline" className="text-yellow-700 border-yellow-400/40 bg-yellow-500/10 gap-1">
      <Clock className="h-3 w-3" /> {label} — Pendiente
    </Badge>
  );
}

export default function LiquidacionSS() {
  const [studentId, setStudentId] = useState<number | undefined>();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: students } = useListStudents({});

  const { data: summary, isLoading, refetch } = useGetSSSummary(
    studentId ?? 0,
    { month, year },
    { query: { enabled: !!studentId, queryKey: ["getSSSummary", studentId, month, year] } },
  );

  const ssPayMut = usePaySSLiquidacion();
  const irpfPayMut = usePayIRPFLiquidacion();

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["getSSSummary", studentId, month, year] });
    refetch();
  };

  const handlePaySS = () => {
    if (!studentId) return;
    ssPayMut.mutate(
      { id: studentId, data: { month, year } },
      {
        onSuccess: (data) => {
          toast({
            title: "Pago SS registrado en Dolibarr",
            description: `Asiento 476→572 · ${fmt(data.total)} · ID: #${data.accountingId}`,
          });
          invalidate();
        },
        onError: (e: unknown) => {
          const msg = (e as { message?: string })?.message ?? "Error al registrar el pago";
          toast({ variant: "destructive", title: "Error", description: msg });
        },
      },
    );
  };

  const handlePayIRPF = () => {
    if (!studentId) return;
    irpfPayMut.mutate(
      { id: studentId, data: { month, year } },
      {
        onSuccess: (data) => {
          toast({
            title: "Pago IRPF (Mod. 111) registrado en Dolibarr",
            description: `Asiento 4751→572 · ${fmt(data.total)} · ID: #${data.accountingId}`,
          });
          invalidate();
        },
        onError: (e: unknown) => {
          const msg = (e as { message?: string })?.message ?? "Error al registrar el pago";
          toast({ variant: "destructive", title: "Error", description: msg });
        },
      },
    );
  };

  const ssAlreadyPaid = summary?.ssPayment?.ssStatus === "paid";
  const irpfAlreadyPaid = summary?.ssPayment?.irpfStatus === "paid";
  const hasPayrolls = (summary?.lines?.length ?? 0) > 0;

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/nominas"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Landmark className="h-6 w-6 text-primary" /> Liquidaciones SS e IRPF
          </h1>
          <p className="text-muted-foreground text-sm">
            RNT · RLC · Registro contable en Dolibarr (476→572, 4751→572)
          </p>
        </div>
      </div>

      {/* Selectores */}
      <div className="flex flex-wrap gap-4 items-center bg-card p-4 rounded-lg border">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">Empresa:</div>
        <Select value={studentId?.toString() ?? ""} onValueChange={(v) => setStudentId(Number(v))}>
          <SelectTrigger className="w-72">
            <SelectValue placeholder="Seleccionar alumno…" />
          </SelectTrigger>
          <SelectContent>
            {students?.map((s) => (
              <SelectItem key={s.id} value={s.id.toString()}>
                {s.companyName ?? `${s.firstName} ${s.lastName}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="flex items-center gap-2 text-sm text-muted-foreground">Período:</div>
        <Select value={String(month)} onValueChange={(v) => setMonth(Number(v))}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            {MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={String(year)} onValueChange={(v) => setYear(Number(v))}>
          <SelectTrigger className="w-24"><SelectValue /></SelectTrigger>
          <SelectContent>
            {[2023, 2024, 2025, 2026].map((y) => (
              <SelectItem key={y} value={String(y)}>{y}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {!studentId ? (
        <div className="flex items-center justify-center h-48 rounded-lg border border-dashed text-muted-foreground">
          Selecciona una empresa para ver las liquidaciones del período
        </div>
      ) : isLoading ? (
        <div className="space-y-4">
          <Skeleton className="h-48 w-full" />
          <Skeleton className="h-32 w-full" />
        </div>
      ) : !hasPayrolls ? (
        <div className="flex flex-col items-center justify-center h-48 rounded-lg border border-dashed text-muted-foreground gap-2">
          <Receipt className="h-8 w-8 text-muted-foreground/30" />
          <p>No hay nóminas calculadas para {MONTHS[month - 1]} {year}.</p>
          <Button asChild variant="link" size="sm">
            <Link href="/nominas/nueva">Calcular una nómina</Link>
          </Button>
        </div>
      ) : (
        <>
          {/* Estado de pagos */}
          {summary?.ssPayment && (
            <div className="flex flex-wrap gap-3 p-4 rounded-lg bg-card border">
              <StatusBadge status={summary.ssPayment.ssStatus} label="Tesorería SS" />
              <StatusBadge status={summary.ssPayment.irpfStatus} label="IRPF / Mod. 111" />
              {summary.ssPayment.ssDolibarrAccountingId && (
                <span className="text-xs text-muted-foreground self-center">
                  Asiento SS: #{summary.ssPayment.ssDolibarrAccountingId}
                </span>
              )}
              {summary.ssPayment.irpfDolibarrAccountingId && (
                <span className="text-xs text-muted-foreground self-center">
                  Asiento IRPF: #{summary.ssPayment.irpfDolibarrAccountingId}
                </span>
              )}
            </div>
          )}

          {/* RNT — Relación Nominal de Trabajadores */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                RNT — Relación Nominal de Trabajadores
                <Badge variant="secondary" className="ml-auto text-xs font-mono">
                  {MONTHS[month - 1]} {year}
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="pl-6">Trabajador</TableHead>
                    <TableHead>Contrato</TableHead>
                    <TableHead className="text-right">Base cotiz.</TableHead>
                    <TableHead className="text-right">SS trab.</TableHead>
                    <TableHead className="text-right">SS empresa</TableHead>
                    <TableHead className="text-right font-semibold">Total SS</TableHead>
                    <TableHead className="text-right">IRPF</TableHead>
                    <TableHead className="text-right">Líquido</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {summary?.lines.map((line) => (
                    <TableRow key={line.payrollId}>
                      <TableCell className="pl-6">
                        <div className="font-medium text-sm">{line.employeeName}</div>
                        <div className="text-xs text-muted-foreground">{line.jobTitle}</div>
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant={line.contractType === "indefinido" ? "default" : "secondary"}
                          className="text-xs"
                        >
                          {line.contractType === "indefinido" ? "Indef." : "Temp."}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm">{fmt(line.baseCotizacion)}</TableCell>
                      <TableCell className="text-right font-mono text-sm text-orange-600 dark:text-orange-400">
                        {fmt(line.ssTrabajador)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm text-orange-700 dark:text-orange-300">
                        {fmt(line.ssEmpresa)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm font-semibold">
                        {fmt(line.totalSS)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm text-red-600 dark:text-red-400">
                        {fmt(line.irpf)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-sm text-green-600 dark:text-green-400">
                        {fmt(line.liquidoPercibir)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* RLC — Resumen de liquidación */}
          <div className="grid md:grid-cols-2 gap-4">

            {/* Bloque SS Tesorería */}
            <Card className={ssAlreadyPaid ? "border-green-500/30 bg-green-500/5" : ""}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <BadgeEuro className="h-4 w-4 text-primary" />
                  Cuota SS — Tesorería SS
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cuota trabajadores</span>
                    <span className="font-mono">{fmt(summary?.totalSSTrabajadores ?? 0)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Cuota empresa</span>
                    <span className="font-mono">{fmt(summary?.totalSSEmpresa ?? 0)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-bold text-base">
                    <span>Total a ingresar</span>
                    <span className="font-mono text-primary">{fmt(summary?.totalSSIngresar ?? 0)}</span>
                  </div>
                </div>

                {/* Asiento contable */}
                <div className="text-xs font-mono bg-muted/40 rounded p-3 space-y-1">
                  <div className="text-muted-foreground font-sans font-medium mb-1 text-xs">Asiento (PGC)</div>
                  <div className="flex items-center gap-2 justify-between">
                    <span>476 Org. SS acreed.</span>
                    <span className="flex items-center gap-1 text-muted-foreground">
                      Debe <ArrowRight className="h-3 w-3" />
                    </span>
                    <span>572 Banco</span>
                  </div>
                  <div className="text-center font-semibold font-sans">{fmt(summary?.totalSSIngresar ?? 0)}</div>
                </div>

                <Button
                  className="w-full"
                  onClick={handlePaySS}
                  disabled={ssAlreadyPaid || ssPayMut.isPending || !hasPayrolls}
                  variant={ssAlreadyPaid ? "outline" : "default"}
                >
                  {ssPayMut.isPending ? (
                    <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Registrando…</>
                  ) : ssAlreadyPaid ? (
                    <><CheckCircle2 className="mr-2 h-4 w-4 text-green-600" /> Ya registrado en Dolibarr</>
                  ) : (
                    <><Landmark className="mr-2 h-4 w-4" /> Registrar pago SS en Dolibarr</>
                  )}
                </Button>
              </CardContent>
            </Card>

            {/* Bloque IRPF / Modelo 111 */}
            <Card className={irpfAlreadyPaid ? "border-green-500/30 bg-green-500/5" : ""}>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Receipt className="h-4 w-4 text-primary" />
                  IRPF — Modelo 111 (Hacienda)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Retenciones IRPF trabajadores</span>
                    <span className="font-mono">{fmt(summary?.totalIrpf ?? 0)}</span>
                  </div>
                  <Separator />
                  <div className="flex justify-between font-bold text-base">
                    <span>Total retenciones</span>
                    <span className="font-mono text-primary">{fmt(summary?.totalIrpf ?? 0)}</span>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Plazo de ingreso: hasta el día 20 del mes siguiente al trimestre
                  </p>
                </div>

                {/* Asiento contable */}
                <div className="text-xs font-mono bg-muted/40 rounded p-3 space-y-1">
                  <div className="text-muted-foreground font-sans font-medium mb-1 text-xs">Asiento (PGC)</div>
                  <div className="flex items-center gap-2 justify-between">
                    <span>4751 HP acr. IRPF</span>
                    <span className="flex items-center gap-1 text-muted-foreground">
                      Debe <ArrowRight className="h-3 w-3" />
                    </span>
                    <span>572 Banco</span>
                  </div>
                  <div className="text-center font-semibold font-sans">{fmt(summary?.totalIrpf ?? 0)}</div>
                </div>

                <Button
                  className="w-full"
                  onClick={handlePayIRPF}
                  disabled={irpfAlreadyPaid || irpfPayMut.isPending || !hasPayrolls}
                  variant={irpfAlreadyPaid ? "outline" : "default"}
                >
                  {irpfPayMut.isPending ? (
                    <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Registrando…</>
                  ) : irpfAlreadyPaid ? (
                    <><CheckCircle2 className="mr-2 h-4 w-4 text-green-600" /> Ya registrado en Dolibarr</>
                  ) : (
                    <><Receipt className="mr-2 h-4 w-4" /> Registrar Modelo 111 en Dolibarr</>
                  )}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* Resumen contable del período */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="h-4 w-4 text-primary" />
                Resumen contable del período — {MONTHS[month - 1]} {year}
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-sm space-y-2">
                <p className="text-xs text-muted-foreground mb-3">
                  Asientos que deben quedar registrados en el libro diario de Dolibarr:
                </p>
                <div className="font-mono bg-muted/40 rounded p-4 text-xs space-y-2">
                  <div className="font-sans font-semibold text-xs text-muted-foreground mb-2">
                    1. Al devengar las nóminas (por nómina individual)
                  </div>
                  <div className="grid grid-cols-3 gap-2 text-muted-foreground font-sans">
                    <span>Cuenta</span><span className="text-right">Debe</span><span className="text-right">Haber</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <span>640 Sueldos</span>
                    <span className="text-right">{fmt(summary?.lines.reduce((s, l) => s + l.baseCotizacion, 0) ?? 0)}</span>
                    <span></span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <span>642 SS empresa</span>
                    <span className="text-right">{fmt(summary?.totalSSEmpresa ?? 0)}</span>
                    <span></span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <span>465 Rem. pendientes</span>
                    <span></span>
                    <span className="text-right">{fmt(summary?.lines.reduce((s, l) => s + l.liquidoPercibir, 0) ?? 0)}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <span>476 SS acreedores</span>
                    <span></span>
                    <span className="text-right">{fmt(summary?.totalSSIngresar ?? 0)}</span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <span>4751 HP IRPF</span>
                    <span></span>
                    <span className="text-right">{fmt(summary?.totalIrpf ?? 0)}</span>
                  </div>

                  <Separator className="my-2" />

                  <div className="font-sans font-semibold text-xs text-muted-foreground mt-3 mb-2">
                    2. Al pagar las nóminas a trabajadores
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <span>465 Rem. pendientes</span>
                    <span className="text-right">{fmt(summary?.lines.reduce((s, l) => s + l.liquidoPercibir, 0) ?? 0)}</span>
                    <span></span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <span>572 Banco c/c</span>
                    <span></span>
                    <span className="text-right">{fmt(summary?.lines.reduce((s, l) => s + l.liquidoPercibir, 0) ?? 0)}</span>
                  </div>

                  <Separator className="my-2" />

                  <div className="font-sans font-semibold text-xs text-muted-foreground mt-3 mb-2">
                    3. Al pagar a Tesorería SS
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <span>476 SS acreedores</span>
                    <span className="text-right">{fmt(summary?.totalSSIngresar ?? 0)}</span>
                    <span></span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <span>572 Banco c/c</span>
                    <span></span>
                    <span className="text-right">{fmt(summary?.totalSSIngresar ?? 0)}</span>
                  </div>

                  <Separator className="my-2" />

                  <div className="font-sans font-semibold text-xs text-muted-foreground mt-3 mb-2">
                    4. Al ingresar IRPF en Hacienda (Mod. 111)
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <span>4751 HP acr. IRPF</span>
                    <span className="text-right">{fmt(summary?.totalIrpf ?? 0)}</span>
                    <span></span>
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <span>572 Banco c/c</span>
                    <span></span>
                    <span className="text-right">{fmt(summary?.totalIrpf ?? 0)}</span>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
