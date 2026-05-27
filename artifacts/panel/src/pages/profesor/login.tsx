import { useState } from "react";
import { useLocation, Link } from "wouter";
import { Lock, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useTeacherLogin } from "@workspace/api-client-react";
import { useTeacherAuth } from "@/contexts/TeacherAuthContext";

export default function ProfesorLogin() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { login } = useTeacherAuth();
  const [, navigate] = useLocation();

  const mutation = useTeacherLogin({
    mutation: {
      onSuccess(data) {
        login(data.token, data.teacher);
        navigate("/profesor/dashboard");
      },
      onError() {
        setError("Usuario o contraseña incorrectos.");
      },
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    mutation.mutate({ data: { username, password } });
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center p-3">
            <div
              className="h-full w-full bg-primary"
              style={{
                maskImage: "url('/images/logo.png')",
                maskSize: "contain",
                maskRepeat: "no-repeat",
                maskPosition: "center",
                WebkitMaskImage: "url('/images/logo.png')",
                WebkitMaskSize: "contain",
                WebkitMaskRepeat: "no-repeat",
                WebkitMaskPosition: "center",
              }}
            />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold">ERP EDU</h1>
            <p className="text-muted-foreground text-sm mt-1">Panel del profesor</p>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-8 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <Lock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Acceso profesor</span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="teacher-username">Usuario</Label>
              <Input
                id="teacher-username"
                placeholder="nombre.apellido"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                autoComplete="username"
                autoFocus
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="teacher-password">Contraseña</Label>
              <Input
                id="teacher-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
              />
            </div>

            {error && <p className="text-sm text-destructive">{error}</p>}

            <Button type="submit" className="w-full" disabled={mutation.isPending || !username || !password}>
              {mutation.isPending ? "Verificando..." : "Entrar"}
            </Button>
          </form>
        </div>

        <div className="flex justify-center mt-6">
          <Link href="/" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1">
            <ArrowLeft className="h-3 w-3" /> Volver a la página principal
          </Link>
        </div>
      </div>
    </div>
  );
}
