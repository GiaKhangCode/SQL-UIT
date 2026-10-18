import React from "react";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import { App } from "./app/App";
import { AuthProvider } from "./context/AuthContext";
import { ThemeProvider } from "./context/ThemeContext";
import "./styles.css";
import { LanguageProvider } from "./context/LanguageContext";
const router = createBrowserRouter([{ path: "*", element: (
      <ThemeProvider>
        <AuthProvider>
          <LanguageProvider><App /></LanguageProvider>
        </AuthProvider>
      </ThemeProvider>
)}]);
createRoot(document.getElementById("root")!).render(
  <React.StrictMode><RouterProvider router={router} /></React.StrictMode>,
);
