import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import type { TeacherProfile } from "@workspace/api-client-react";

const STORAGE_KEY = "dolibarr-edu-teacher-token";
const PROFILE_KEY = "dolibarr-edu-teacher-profile";

interface TeacherAuthContextValue {
  token: string | null;
  teacher: TeacherProfile | null;
  isAuthenticated: boolean;
  login: (token: string, teacher: TeacherProfile) => void;
  logout: () => void;
}

const TeacherAuthContext = createContext<TeacherAuthContextValue | null>(null);

export function TeacherAuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(STORAGE_KEY));
  const [teacher, setTeacher] = useState<TeacherProfile | null>(() => {
    const raw = localStorage.getItem(PROFILE_KEY);
    if (!raw) return null;
    try { return JSON.parse(raw) as TeacherProfile; } catch { return null; }
  });

  const login = useCallback((newToken: string, profile: TeacherProfile) => {
    localStorage.setItem(STORAGE_KEY, newToken);
    localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));
    setToken(newToken);
    setTeacher(profile);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(PROFILE_KEY);
    setToken(null);
    setTeacher(null);
  }, []);

  return (
    <TeacherAuthContext.Provider value={{ token, teacher, isAuthenticated: !!token, login, logout }}>
      {children}
    </TeacherAuthContext.Provider>
  );
}

export function useTeacherAuth(): TeacherAuthContextValue {
  const ctx = useContext(TeacherAuthContext);
  if (!ctx) throw new Error("useTeacherAuth must be used inside TeacherAuthProvider");
  return ctx;
}

export function getTeacherToken(): string | null {
  return localStorage.getItem(STORAGE_KEY);
}
