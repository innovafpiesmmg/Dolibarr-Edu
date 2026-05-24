import { useState } from "react";
import { useLocation } from "wouter";
import { BookOpen, Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAdminLogin } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";

export default function LoginPage() {
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const { login } = useAuth();
  const [, navigate] = useLocation();

  const mutation = useAdminLogin({
    mutation: {
      onSuccess(data) {
        login(data.token);
        navigate("/dashboard");
      },
      onError() {
        setError("Contraseña incorrecta. Inténtalo de nuevo.");
      },
    },
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    mutation.mutate({ data: { password } });
  }

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="flex flex-col items-center gap-3 mb-8">
          <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center">
            <BookOpen className="h-8 w-8 text-primary" />
          </div>
          <div className="text-center">
            <h1 className="text-2xl font-bold">Dolibarr EDU</h1>
            <p className="text-muted-foreground text-sm mt-1">Panel de gestión</p>
          </div>
        </div>

        <div className="bg-card border border-border rounded-2xl p-8 shadow-sm">
          <div className="flex items-center gap-2 mb-6">
            <Lock className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm font-medium text-muted-foreground">Acceso restringido</span>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">Contraseña del panel</Label>
              <Input
                id="password"
                type="password"
                placeholder="Introduce la contraseña"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoFocus
                required
              />
            </div>

            {error && (
              <p className="text-sm text-destructive">{error}</p>
            )}

            <Button
              type="submit"
              className="w-full"
              disabled={mutation.isPending || !password}
            >
              {mutation.isPending ? "Verificando..." : "Entrar al panel"}
            </Button>
          </form>
        </div>

        <p className="text-center text-xs text-muted-foreground mt-6">
          La contraseña se configura durante la instalación del servidor.
        </p>
      </div>
    </div>
  );
}
