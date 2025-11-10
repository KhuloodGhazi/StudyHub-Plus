import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import "./index.css";
import App from "./App.tsx";
import { AuthProvider } from "./contexts/AuthContext";

// استيراد الصفحات
import Dashboard from "./pages/Dashboard";
import Challenges from "./pages/Challenges";
import ChallengeDetails from "./pages/ChallengeDetails";
import Login from "./pages/Login";
import Register from "./pages/Register";
import OnePage from "./pages/OnePage";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* الصفحة الرئيسية */}
          <Route path="/" element={<App />} />

          {/* صفحات المستخدم */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* صفحات النظام */}
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/challenges" element={<Challenges />} />
          <Route path="/challenges/:id" element={<ChallengeDetails />} />
          <Route path="/app" element={<OnePage />} />

        </Routes>
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);

