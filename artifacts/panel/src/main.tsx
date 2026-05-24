import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { setAuthTokenGetter } from "@workspace/api-client-react";

const STORAGE_KEY = "dolibarr-edu-token";
setAuthTokenGetter(() => localStorage.getItem(STORAGE_KEY));

createRoot(document.getElementById("root")!).render(<App />);
