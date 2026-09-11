import React from "react";
import { createRoot } from "react-dom/client";
import "./style.css";

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <main>
      <h1>{import.meta.env.VITE_APP_TITLE ?? "Family Calendar"}</h1>
      <p>Software POC is running.</p>
    </main>
  </React.StrictMode>,
);
