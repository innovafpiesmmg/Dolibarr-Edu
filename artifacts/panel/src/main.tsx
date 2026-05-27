import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setAuthTokenGetter } from "@workspace/api-client-react";

const ADMIN_KEY = "dolibarr-edu-token";
const TEACHER_KEY = "dolibarr-edu-teacher-token";
const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

setAuthTokenGetter(() => {
  const path = window.location.pathname;
  const sub = path.startsWith(BASE) ? path.slice(BASE.length) : path;
  if (sub.startsWith("/profesor")) return localStorage.getItem(TEACHER_KEY);
  return localStorage.getItem(ADMIN_KEY);
});

createRoot(document.getElementById("root")!).render(<App />);
