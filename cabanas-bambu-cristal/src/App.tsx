import { lazy, Suspense } from "react";
import { HashRouter, Navigate, Route, Routes } from "react-router-dom";
import { Layout } from "./components/Layout";
import { SiteProvider } from "./lib/SiteContext";
import { BookPage } from "./pages/BookPage";
import { CabinPage } from "./pages/CabinPage";
import { Home } from "./pages/Home";

// O painel só é baixado quando alguém abre /admin
const AdminApp = lazy(() => import("./admin/Admin").then((m) => ({ default: m.AdminApp })));

// HashRouter: funciona em qualquer hospedagem estática sem configurar o servidor.
export default function App() {
  return (
    <SiteProvider>
      <HashRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Home />} />
            <Route path="cabana/:slug" element={<CabinPage />} />
            <Route path="reservar" element={<BookPage />} />
          </Route>
          <Route
            path="admin"
            element={
              <Suspense fallback={null}>
                <AdminApp />
              </Suspense>
            }
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </HashRouter>
    </SiteProvider>
  );
}
