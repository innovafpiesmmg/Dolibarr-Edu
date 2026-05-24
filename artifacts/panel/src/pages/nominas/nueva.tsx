import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import {
  useListStudents,
  useListEmployees,
  useCalculatePayroll,
  useCreatePayroll,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Calculator, Save, RefreshCw, AlertCircle, CheckCircle2, Building2, Banknote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";

const MONTHS = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

const fmt = (n: number) => n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";
const fmtPct = (n: number) => n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " %";

const now = new Date();

export default function NuevaNomina() {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [studentId, setStudentId] = useState<number | undefined>();
  const [employeeId, setEmployeeId] = useState<number | undefined>();
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [year, setYear] = useState(now.getFullYear());
  const [extras, setExtras] = useState({ plusConvenio: "0", plusTransporte: "0", importeHorasExtra: "0", otroDevengo: "0", otroDevengoLabel: "" });
  const [irpfOverride, setIrpfOverride] = useState("");
  const [preview, setPreview] = useState<ReturnType<typeof useCalculatePayroll>["data"]>(undefined);

  const { data: students } = useListStudents({});
  const { data: employees } = useListEmployees({ studentId: studentId ?? 0 }, { query: { enabled: !!studentId, queryKey: ["listEmployees", studentId] } });

  const calcMut = useCalculatePayroll();
  const saveMut = useCreatePayroll();

  const selectedEmployee = employees?.find((e) => e.id === employeeId);

  const buildPayload = () => ({
    employeeId: employeeId!,
    studentId: studentId!,
    periodMonth: month,
    periodYear: year,
    plusConvenio: Number(extras.plusConvenio) || 0,
    plusTransporte: Number(extras.plusTransporte) || 0,
    importeHorasExtra: Number(extras.importeHorasExtra) || 0,
    otroDevengo: Number(extras.otroDevengo) || 0,
    otroDevengoLabel: extras.otroDevengoLabel || undefined,
    irpfRateOverride: irpfOverride ? Number(irpfOverride) : undefined,
  });

  const handleCalculate = () => {
    if (!employeeId || !studentId) return;
    calcMut.mutate({ data: buildPayload() }, {
      onSuccess: (data) => setPreview(data),
      onError: () => toast({ variant: "destructive", title: "Error al calcular la nómina" }),
    });
  };

  const handleSave = () => {
    if (!employeeId || !studentId) return;
    saveMut.mutate({ data: buildPayload() }, {
      onSuccess: (data) => {
        queryClient.invalidateQueries({ queryKey: ["listPayrolls"] });
        const syncStatus = data.dolibarrSyncStatus;
        if (syncStatus === "synced") {
          toast({
            title: "Nómina guardada y sincronizada con Dolibarr",
            description: "Registrada en Salarios y Contabilidad del ERP del alumno.",
          });
        } else if (syncStatus === "error") {
          toast({
            variant: "destructive",
            title: "Nómina guardada — error en Dolibarr",
            description: data.dolibarrSyncError ?? "Comprueba la configuración de Dolibarr.",
          });
        } else {
          toast({ title: "Nómina guardada correctamente" });
        }
        navigate("/nominas");
      },
      onError: () => toast({ variant: "destructive", title: "Error al guardar la nómina" }),
    });
  };

  // Recalcular automáticamente al cambiar conceptos clave
  useEffect(() => {
    if (employeeId && studentId) setPreview(undefined);
  }, [employeeId, studentId, month, year, extras, irpfOverride]);

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" asChild>
          <Link href="/nominas"><ArrowLeft className="h-4 w-4" /></Link>
        </Button>
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Calculator className="h-6 w-6 text-primary" /> Nueva Nómina
          </h1>
          <p className="text-muted-foreground text-sm">Cálculo según normativa española 2024</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Formulario izquierdo */}
        <div className="space-y-4">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">1. Empresa y Trabajador</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Empresa (alumno)</Label>
                <Select value={studentId?.toString() ?? ""} onValueChange={(v) => { setStudentId(Number(v)); setEmployeeId(undefined); setPreview(undefined); }}>
                  <SelectTrigger><SelectValue placeholder="Seleccionar alumno…" /></SelectTrigger>
                  <SelectContent>
                    {students?.map((s) => (
                      <SelectItem key={s.id} value={s.id.toString()}>
                        {s.companyName ?? `${s.firstName} ${s.lastName}`}
                        {s.dolibarrSyncStatus === "synced" && <span className="text-green-600 ml-1">✓ ERP</span>}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Trabajador</Label>
                <Select
                  value={employeeId?.toString() ?? ""}
                  onValueChange={(v) => { setEmployeeId(Number(v)); setPreview(undefined); }}
                  disabled={!studentId || !employees?.length}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={!studentId ? "Selecciona primero una empresa" : "Seleccionar trabajador…"} />
                  </SelectTrigger>
                  <SelectContent>
                    {employees?.map((e) => (
                      <SelectItem key={e.id} value={e.id.toString()}>
                        {e.firstName} {e.lastName} — {e.jobTitle}
                        {e.dolibarrSyncStatus === "synced" && <span className="text-green-600 ml-1">✓ ERP</span>}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {selectedEmployee && (
                <div className="p-3 rounded-lg bg-muted/50 border text-sm space-y-1">
                  <div className="flex justify-between"><span className="text-muted-foreground">Salario base</span><span className="font-mono font-semibold">{fmt(selectedEmployee.salaryBase)}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Pagas</span><span>{selectedEmployee.extraPayments}</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">IRPF</span><span>{selectedEmployee.irpfRate}%</span></div>
                  <div className="flex justify-between"><span className="text-muted-foreground">Contrato</span><Badge variant={selectedEmployee.contractType === "indefinido" ? "default" : "secondary"} className="text-xs">{selectedEmployee.contractType}</Badge></div>
                  {selectedEmployee.dolibarrSyncStatus === "synced" ? (
                    <div className="flex justify-between text-green-700 dark:text-green-400 text-xs pt-1"><span>Registrado en Dolibarr HRM</span><CheckCircle2 className="h-3.5 w-3.5" /></div>
                  ) : selectedEmployee.dolibarrSyncStatus === "error" ? (
                    <div className="flex items-center gap-1 text-red-600 text-xs pt-1"><AlertCircle className="h-3.5 w-3.5" /> Error sync ERP</div>
                  ) : (
                    <div className="text-xs text-yellow-600 pt-1">⚠ Pendiente de sync con ERP</div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">2. Período</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Mes</Label>
                <Select value={String(month)} onValueChange={(v) => { setMonth(Number(v)); setPreview(undefined); }}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {MONTHS.map((m, i) => <SelectItem key={i} value={String(i + 1)}>{m}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Año</Label>
                <Input type="number" value={year} onChange={(e) => { setYear(Number(e.target.value)); setPreview(undefined); }} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">3. Complementos salariales</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { key: "plusConvenio", label: "Plus de convenio" },
                { key: "plusTransporte", label: "Plus de transporte" },
                { key: "importeHorasExtra", label: "Horas extraordinarias" },
              ].map(({ key, label }) => (
                <div key={key} className="grid grid-cols-2 gap-3 items-center">
                  <Label className="text-sm">{label}</Label>
                  <Input
                    type="number"
                    value={extras[key as keyof typeof extras]}
                    onChange={(e) => { setExtras({ ...extras, [key]: e.target.value }); setPreview(undefined); }}
                    placeholder="0,00"
                  />
                </div>
              ))}
              <div className="grid grid-cols-2 gap-3 items-center">
                <Label className="text-sm">Otro concepto</Label>
                <Input
                  type="number"
                  value={extras.otroDevengo}
                  onChange={(e) => { setExtras({ ...extras, otroDevengo: e.target.value }); setPreview(undefined); }}
                  placeholder="0,00"
                />
              </div>
              {Number(extras.otroDevengo) > 0 && (
                <div className="grid grid-cols-2 gap-3 items-center">
                  <Label className="text-sm text-muted-foreground">Descripción</Label>
                  <Input
                    value={extras.otroDevengoLabel}
                    onChange={(e) => setExtras({ ...extras, otroDevengoLabel: e.target.value })}
                    placeholder="Concepto…"
                  />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3 items-center pt-1 border-t">
                <Label className="text-sm">% IRPF (sobreescribir)</Label>
                <Input
                  type="number"
                  value={irpfOverride}
                  onChange={(e) => { setIrpfOverride(e.target.value); setPreview(undefined); }}
                  placeholder={selectedEmployee ? `${selectedEmployee.irpfRate}% (automático)` : "—"}
                />
              </div>
            </CardContent>
          </Card>

          <Button
            onClick={handleCalculate}
            disabled={!employeeId || !studentId || calcMut.isPending}
            className="w-full"
            variant="outline"
            size="lg"
          >
            {calcMut.isPending ? <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Calculando…</> : <><Calculator className="mr-2 h-4 w-4" /> Calcular Nómina</>}
          </Button>
        </div>

        {/* Resultado derecha */}
        <div className="space-y-4">
          {preview ? (
            <>
              <Card className="border-primary/20">
                <CardHeader className="pb-2 bg-primary/5 rounded-t-lg">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Banknote className="h-5 w-5 text-primary" />
                    Recibo de Salario — {MONTHS[preview.periodMonth - 1]} {preview.periodYear}
                  </CardTitle>
                </CardHeader>
                <CardContent className="pt-4 space-y-4">
                  {/* Devengos */}
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Devengos</div>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between"><span>Salario base</span><span className="font-mono">{fmt(preview.salaryBase)}</span></div>
                      {preview.plusConvenio > 0 && <div className="flex justify-between"><span>Plus de convenio</span><span className="font-mono">{fmt(preview.plusConvenio)}</span></div>}
                      {preview.plusTransporte > 0 && <div className="flex justify-between"><span>Plus transporte</span><span className="font-mono">{fmt(preview.plusTransporte)}</span></div>}
                      {preview.importeHorasExtra > 0 && <div className="flex justify-between"><span>Horas extra</span><span className="font-mono">{fmt(preview.importeHorasExtra)}</span></div>}
                      {preview.otroDevengo > 0 && <div className="flex justify-between"><span>{preview.otroDevengoLabel ?? "Otros devengos"}</span><span className="font-mono">{fmt(preview.otroDevengo)}</span></div>}
                      {preview.prorataPagasExtra > 0 && <div className="flex justify-between text-muted-foreground"><span>Prorrata pagas extra</span><span className="font-mono">{fmt(preview.prorataPagasExtra)}</span></div>}
                      <div className="flex justify-between font-semibold border-t pt-1 mt-1">
                        <span>Total devengos</span><span className="font-mono">{fmt(preview.totalDevengos)}</span>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Deducciones */}
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Deducciones trabajador</div>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between text-orange-700 dark:text-orange-400">
                        <span>SS Contingencias Comunes (4,70%)</span>
                        <span className="font-mono">-{fmt(preview.ssContingencias)}</span>
                      </div>
                      <div className="flex justify-between text-orange-700 dark:text-orange-400">
                        <span>SS Desempleo ({selectedEmployee?.contractType === "temporal" ? "1,60" : "1,55"}%)</span>
                        <span className="font-mono">-{fmt(preview.ssDesempleo)}</span>
                      </div>
                      <div className="flex justify-between text-orange-700 dark:text-orange-400">
                        <span>SS Formación Profesional (0,10%)</span>
                        <span className="font-mono">-{fmt(preview.ssFp)}</span>
                      </div>
                      <div className="flex justify-between text-orange-700 dark:text-orange-400 font-medium">
                        <span>Total SS trabajador</span>
                        <span className="font-mono">-{fmt(preview.totalSsTrabajador)}</span>
                      </div>
                      <div className="flex justify-between text-red-700 dark:text-red-400 mt-1">
                        <span>Retención IRPF ({fmtPct(preview.irpfRate)})</span>
                        <span className="font-mono">-{fmt(preview.irpfAmount)}</span>
                      </div>
                      <div className="flex justify-between font-semibold border-t pt-1 mt-1">
                        <span>Total deducciones</span><span className="font-mono text-destructive">-{fmt(preview.totalDeducciones)}</span>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  <div className="flex justify-between text-lg font-bold bg-green-500/10 text-green-700 dark:text-green-300 p-3 rounded-lg border border-green-500/20">
                    <span>Líquido a percibir</span>
                    <span className="font-mono">{fmt(preview.liquidoPercibir)}</span>
                  </div>

                  <Separator />

                  {/* Coste empresa */}
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">Coste empresa (SS empresa)</div>
                    <div className="space-y-1 text-sm text-muted-foreground">
                      <div className="flex justify-between"><span>Contingencias (23,60%)</span><span className="font-mono">{fmt(preview.ssEmpresaContingencias)}</span></div>
                      <div className="flex justify-between"><span>Desempleo ({selectedEmployee?.contractType === "temporal" ? "6,70" : "5,50"}%)</span><span className="font-mono">{fmt(preview.ssEmpresaDesempleo)}</span></div>
                      <div className="flex justify-between"><span>Formación Profesional (0,60%)</span><span className="font-mono">{fmt(preview.ssEmpresaFp)}</span></div>
                      <div className="flex justify-between"><span>FOGASA (0,20%)</span><span className="font-mono">{fmt(preview.ssEmpresaFogasa)}</span></div>
                      <div className="flex justify-between font-medium text-foreground border-t pt-1 mt-1">
                        <span>Total SS empresa</span><span className="font-mono">{fmt(preview.totalSsEmpresa)}</span>
                      </div>
                      <div className="flex justify-between font-bold text-foreground pt-1">
                        <span>Coste total empresa</span><span className="font-mono">{fmt(preview.totalCosteEmpresa)}</span>
                      </div>
                    </div>
                  </div>

                  <Separator />

                  {/* Apuntes contables */}
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1">
                      <Building2 className="h-3.5 w-3.5" /> Apuntes contables (PGC) que se crearán en Dolibarr
                    </div>
                    <div className="space-y-1 text-xs font-mono bg-muted/40 rounded p-3">
                      <div className="grid grid-cols-3 gap-2 text-muted-foreground font-sans font-medium mb-1">
                        <span>Cuenta</span><span className="text-right">Debe</span><span className="text-right">Haber</span>
                      </div>
                      <div className="grid grid-cols-3 gap-2"><span>640 Sueldos</span><span className="text-right">{fmt(preview.totalDevengos)}</span><span></span></div>
                      <div className="grid grid-cols-3 gap-2"><span>642 SS empresa</span><span className="text-right">{fmt(preview.totalSsEmpresa)}</span><span></span></div>
                      <div className="grid grid-cols-3 gap-2"><span>465 Rem. pend.</span><span></span><span className="text-right">{fmt(preview.liquidoPercibir)}</span></div>
                      <div className="grid grid-cols-3 gap-2"><span>476 SS acreed.</span><span></span><span className="text-right">{fmt(preview.totalSsTrabajador + preview.totalSsEmpresa)}</span></div>
                      <div className="grid grid-cols-3 gap-2"><span>4751 HP IRPF</span><span></span><span className="text-right">{fmt(preview.irpfAmount)}</span></div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <Button
                onClick={handleSave}
                disabled={saveMut.isPending}
                className="w-full"
                size="lg"
              >
                {saveMut.isPending
                  ? <><RefreshCw className="mr-2 h-4 w-4 animate-spin" /> Guardando y sincronizando…</>
                  : <><Save className="mr-2 h-4 w-4" /> Guardar nómina y enviar a Dolibarr</>}
              </Button>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full min-h-[400px] rounded-lg border border-dashed text-muted-foreground gap-3">
              <Calculator className="h-12 w-12 text-muted-foreground/30" />
              <p className="text-sm">Selecciona trabajador y período, luego pulsa <strong>Calcular Nómina</strong></p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
