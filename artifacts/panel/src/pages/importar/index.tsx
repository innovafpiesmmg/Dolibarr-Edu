import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useListGroups, useCreateStudentsBulk } from "@workspace/api-client-react";
import { Upload, FileText, CheckCircle2, AlertTriangle, HelpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const formSchema = z.object({
  groupId: z.coerce.number().min(1, "Debes seleccionar un grupo destino"),
  csvData: z.string().min(10, "Pega el contenido CSV"),
});

export default function ImportarAlumnos() {
  const { data: groups, isLoading: isLoadingGroups } = useListGroups({});
  const createBulk = useCreateStudentsBulk();
  const { toast } = useToast();
  
  const [result, setResult] = useState<{created: number, errors: {username: string, error: string}[]} | null>(null);

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      groupId: 0,
      csvData: "",
    },
  });

  const onSubmit = (values: z.infer<typeof formSchema>) => {
    // Parse naive CSV (nombre,apellidos,email,username,password,empresa)
    const lines = values.csvData.split('\n').filter(line => line.trim() !== '');
    
    // Skip header if exists
    let startIndex = 0;
    if (lines[0].toLowerCase().includes('nombre') || lines[0].toLowerCase().includes('username')) {
      startIndex = 1;
    }

    const studentsToCreate = [];
    
    for (let i = startIndex; i < lines.length; i++) {
      const parts = lines[i].split(',').map(s => s.trim());
      if (parts.length >= 5) {
        studentsToCreate.push({
          firstName: parts[0],
          lastName: parts[1],
          email: parts[2],
          username: parts[3],
          password: parts[4],
          companyName: parts[5] || undefined,
          groupId: values.groupId
        });
      }
    }

    if (studentsToCreate.length === 0) {
      toast({ variant: "destructive", title: "Error", description: "No se encontraron filas válidas en el CSV." });
      return;
    }

    createBulk.mutate({ 
      data: { 
        groupId: values.groupId, 
        students: studentsToCreate 
      } 
    }, {
      onSuccess: (res) => {
        setResult(res);
        if (res.errors.length === 0) {
          toast({ title: "Importación Completada", description: `Se crearon ${res.created} alumnos.` });
          form.reset({ groupId: values.groupId, csvData: "" });
        } else {
          toast({ variant: "destructive", title: "Importación con errores", description: `Se crearon ${res.created} alumnos, pero hubo ${res.errors.length} errores.` });
        }
      },
      onError: () => {
        toast({ variant: "destructive", title: "Error fatal", description: "Ocurrió un problema procesando la importación masiva." });
      }
    });
  };

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Importación Masiva</h1>
        <p className="text-muted-foreground">Sube listados de alumnos y despliega sus entornos de forma automática.</p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <Card className="md:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Upload className="h-5 w-5 text-primary" />
              Pegar datos CSV
            </CardTitle>
            <CardDescription>Pega directamente desde Excel o Calc. Las columnas deben estar separadas por comas.</CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <FormField
                  control={form.control}
                  name="groupId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Grupo Destino</FormLabel>
                      <Select 
                        disabled={isLoadingGroups} 
                        onValueChange={field.onChange} 
                        defaultValue={field.value ? field.value.toString() : undefined}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Selecciona el grupo..." />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {groups?.map(g => (
                            <SelectItem key={g.id} value={g.id.toString()}>{g.name}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="csvData"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex justify-between items-end">
                        <span>Datos CSV</span>
                      </FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="Nombre,Apellidos,Email,Usuario,Contraseña,NombreEmpresa" 
                          className="font-mono text-sm h-64 resize-y" 
                          {...field} 
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <Button type="submit" size="lg" className="w-full" disabled={createBulk.isPending}>
                  {createBulk.isPending ? "Procesando importación..." : "Iniciar Importación y Despliegue"}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="bg-primary/5 border-primary/20">
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <HelpCircle className="h-4 w-4 text-primary" />
                Formato requerido
              </CardTitle>
            </CardHeader>
            <CardContent className="text-sm space-y-4">
              <p>El sistema espera exactamente este orden de columnas separadas por comas:</p>
              <ol className="list-decimal pl-4 space-y-1 text-muted-foreground font-mono text-xs">
                <li>Nombre</li>
                <li>Apellidos</li>
                <li>Email</li>
                <li>Username</li>
                <li>Contraseña</li>
                <li>NombreEmpresa <span className="text-muted-foreground/50">(Opcional)</span></li>
              </ol>
              <div className="pt-4 border-t border-primary/10">
                <p className="font-semibold mb-2 text-foreground">Ejemplo:</p>
                <div className="bg-background p-2 rounded text-xs font-mono text-muted-foreground break-words border border-border">
                  Ana,García,ana@edu.es,agarcia,Ana1234!,TecnoAna SL
                </div>
              </div>
            </CardContent>
          </Card>

          {result && (
            <Card className={result.errors.length > 0 ? "border-destructive/50" : "border-green-500/50"}>
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  {result.errors.length === 0 ? (
                    <><CheckCircle2 className="h-5 w-5 text-green-500" /> Importación Exitosa</>
                  ) : (
                    <><AlertTriangle className="h-5 w-5 text-destructive" /> Hubo problemas</>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold mb-1">{result.created}</div>
                <div className="text-sm text-muted-foreground mb-4">Alumnos importados y empresas desplegadas.</div>
                
                {result.errors.length > 0 && (
                  <div className="space-y-2 mt-4 pt-4 border-t">
                    <p className="text-sm font-medium text-destructive">{result.errors.length} filas fallaron:</p>
                    <div className="max-h-32 overflow-y-auto space-y-1 text-xs">
                      {result.errors.map((err, i) => (
                        <div key={i} className="bg-destructive/10 text-destructive p-2 rounded">
                          <span className="font-bold">{err.username}:</span> {err.error}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
