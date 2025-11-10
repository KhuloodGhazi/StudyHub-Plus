import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Dashboard from "./Dashboard";
import Challenges from "./Challenges";
import FocusTimer from "./FocusTimer"; // ✅ تأكد أن اسم الملف مطابق للموجود فعلاً عندك

function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="section-card">
      <h2 className="section-title">{title}</h2>
      {children}
    </section>
  );
}

export default function OnePage() {
  const { hash } = useLocation();

  // ✅ سكرول ناعم
  useEffect(() => {
    const prev = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = "smooth";
    return () => {
      document.documentElement.style.scrollBehavior = prev;
    };
  }, []);

  // ✅ القفز حسب الهاش (#dashboard / #focus / #group)
  useEffect(() => {
    const id = (hash || "").slice(1);
    if (!id) return;
    document
      .getElementById(id)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [hash]);

  return (
    <div className="shell">
      <aside className="shell-aside">
        <Sidebar />
      </aside>

      <main className="shell-main">
        <div className="content">
          {/* ✅ القسم الأول: الداشبورد */}
          <Section id="dashboard" title="Your Dashboard">
            <Dashboard />
          </Section>

          {/* ✅ القسم الثاني: الفوكس تايمر */}
          <Section id="focus" title="Focus Timer">
            <div style={{ maxWidth: 420, margin: "0 auto" }}>
              <FocusTimer />
            </div>
          </Section>

          {/* ✅ القسم الثالث: التحديات */}
          <Section id="group" title="Group Challenge">
            <Challenges />
          </Section>
        </div>
      </main>
    </div>
  );
}
