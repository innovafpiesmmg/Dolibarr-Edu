import { useState } from "react";
import { Link } from "wouter";
import { useListPayrolls, useDeletePayroll, useListStudents, useListEmployees } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Calculator, Users2, FileText, Plus, Trash2, Banknote, Building2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useToast } from "@/hooks/use-toast";
import { AlertTriangle } from "lucide-react";

const MONTHS = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];

const fmt = (n: number) =>
  n.toLocaleString("es-ES", { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " €";

export default function NominasIndex() {
  const [studentId, setStudentId] = useState<number | undefined>(undefined);
  const [toDelete, setToDelete] = useState<number | null>(null);
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const { data: students } = useListStudents({});
  const { data: payrolls, isLoading } = useListPayrolls({ studentId });
  const { data: employees } = useListEmployees({ studentId: studentId ?? 0 }, {
    query: { enabled: !!studentId, queryKey: ["listEmployees", studentId] },
  });
  const deleteMut = useDeletePayroll();

  const handleDelete = () => {
    if (!toDelete) return;
    deleteMut.mutate({ id: toDelete }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["listPayrolls"] });
        setToDelete(null);
        toast({ title: "Nómina eliminada" });
      },
      onError: () => toast({ variant: "destructive", title: "Error al eliminar la nómina" }),
    });
  };

  const totalPayrolls = payrolls?.length ?? 0;
  const totalEmployees = studentId ? (employees?.length ?? 0) : "—";

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight flex items-center gap-2">
            <Banknote className="h-8 w-8 text-primary" /> Nóminas y SS
          </h1>
          <p className="text-muted-foreground">Módulo educativo de nóminas — normativa española 2024</p>
        </div>
        <div className="flex gap-2">
          <Button asChild variant="outline">
            <Link href="/nominas/empleados"><Users2 className="mr-2 h-4 w-4" /> Trabajadores</Link>
          </Button>
          <Button asChild>
            <Link href="/nominas/nueva"><Plus className="mr-2 h-4 w-4" /> Nueva Nómina</Link>
          </Button>
        </div>
      </div>

      <div className="flex gap-4 items-center bg-card p-4 rounded-lg border">
        <div className="text-sm text-muted-foreground">Filtrar por alumno:</div>
        <Select
          value={studentId?.toString() ?? "all"}
          onValueChange={(v) => setStudentId(v === "all" ? undefined : Number(v))}
        >
          <SelectTrigger className="w-64">
            <SelectValue placeholder="Todos los alumnos" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos los alumnos</SelectItem>
            {students?.map((s) => (
              <SelectItem key={s.id} value={s.id.toString()}>
                {s.firstName} {s.lastName} — {s.companyName ?? "Sin empresa"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Nóminas generadas</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold font-mono">{totalPayrolls}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Trabajadores</CardTitle></CardHeader>
          <CardContent><div className="text-3xl font-bold font-mono">{totalEmployees}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Líquido total pagado</CardTitle></CardHeader>
          <CardContent>
            <div className="text-xl font-bold font-mono text-green-600 dark:text-green-400">
              {payrolls ? fmt(payrolls.reduce((acc, p) => acc + p.liquidoPercibir, 0)) : "—"}
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" /> Nóminas
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="pl-6">Período</TableHead>
                <TableHead>Empresa / Trabajador</TableHead>
                <TableHead className="text-right">Bruto</TableHead>
                <TableHead className="text-right">SS Trab.</TableHead>
                <TableHead className="text-right">IRPF</TableHead>
                <TableHead className="text-right font-semibold">Líquido</TableHead>
                <TableHead className="w-[80px]"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: 4 }).map((_, i) => (
                  <TableRow key={i}>
                    {Array.from({ length: 7 }).map((__, j) => (
                      <TableCell key={j}><Skeleton className="h-4 w-full" /></TableCell>
                    ))}
                  </TableRow>
                ))
              ) : payrolls?.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="h-32 text-center text-muted-foreground">
                    <Calculator className="h-8 w-8 mx-auto mb-2 text-muted-foreground/30" />
                    No hay nóminas. <Link href="/nominas/nueva" className="text-primary hover:underline">Calcular la primera</Link>
                  </TableCell>
                </TableRow>
              ) : (
                payrolls?.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="pl-6">
                      <Badge variant="secondary" className="font-mono text-xs">
                        {MONTHS[(p.periodMonth ?? 1) - 1]} {p.periodYear}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 text-sm">
                        <Building2 className="h-3.5 w-3.5 text-muted-foreground" />
                        <span>Emp. #{p.employeeId}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-mono text-sm">{fmt(p.totalDevengos)}</TableCell>
                    <TableCell className="text-right font-mono text-sm text-orange-600 dark:text-orange-400">-{fmt(p.totalSsTrabajador)}</TableCell>
                    <TableCell className="text-right font-mono text-sm text-red-600 dark:text-red-400">-{fmt(p.irpfAmount)}</TableCell>
                    <TableCell className="text-right font-mono font-semibold text-green-600 dark:text-green-400">{fmt(p.liquidoPercibir)}</TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" asChild className="h-8 w-8">
                          <Link href={`/nominas/${p.id}`}><FileText className="h-4 w-4" /></Link>
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => setToDelete(p.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={toDelete !== null} onOpenChange={(o) => !o && setToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangle className="h-5 w-5" /> Eliminar nómina
            </DialogTitle>
            <DialogDescription>Esta acción es irreversible.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setToDelete(null)}>Cancelar</Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleteMut.isPending}>
              {deleteMut.isPending ? "Eliminando..." : "Eliminar"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
