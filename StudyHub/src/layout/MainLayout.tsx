import type { ReactNode } from "react";
import Sidebar from "../components/Sidebar";
import "../css/Sidebar.css";

interface MainLayoutProps {
  children: ReactNode;
}

export default function MainLayout({ children }: MainLayoutProps) {
  return (
    <div style={{ display: "flex", height: "100vh" }}>
      <Sidebar />
      <main style={{ flex: 1, padding: "20px", backgroundColor: "#f9f8f7" }}>
        {children}
      </main>
    </div>
  );
}

{/*import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import "../css/Sidebar.css";


{/*import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import "../css/Sidebar.css";


{/*import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import "../css/Sidebar.css";

{/*import { Outlet } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import "../css/Sidebar.css";

/**
 * MainLayout Component
 * --------------------
 * الإطار العام للموقع بعد تسجيل الدخول.
 * يحتوي على:
 * - الشريط الجانبي (Sidebar)
 * - منطقة العرض الرئيسية (main)
 * حيث يتم عرض الصفحات الداخلية مثل Dashboard وChallenges وChallengeDetails.
 

export default function MainLayout() {
  return (
    <div style={{ display: "flex", height: "100vh" }}>
      {/* الشريط الجانبي */}
      <Sidebar />

      {/* المنطقة الرئيسية *
      <main
        style={{
          flex: 1,
          padding: "20px",
          backgroundColor: "#f9f8f7",
          overflowY: "auto",
          borderRadius: "12px 0 0 12px",
        }}
      >
        {/* يتم هنا عرض الصفحات الداخلية تلقائيًا حسب المسار *
        <Outlet />
      </main>
    </div>
  );
}*/}
