import React, { useEffect, useRef, useState, type ReactNode } from "react";
import { useLocation } from "react-router-dom";
import Sidebar from "../components/Sidebar";
import Dashboard from "./Dashboard";
import Challenges from "./Challenges";


/* ========= Section wrapper ========= */
function Section({
  id,
  title,
  children,
}: {
  id: string;
  title: string;
  children: ReactNode;
}) {
  return (
    <section id={id} className="section-card">
      <h2 className="section-title">{title}</h2>
      {children}
    </section>
  );
}

/* ========= FocusTimer (يربط بـ main.her.py) ========= */
function FocusTimer() {
  const [seconds, setSeconds] = useState<number>(25 * 60);
  const [running, setRunning] = useState<boolean>(false);
  const tickRef = useRef<number | null>(null);

  // الحالة الأولية
  useEffect(() => {
    fetch("http://127.0.0.1:8000/api/status")
      .then((r) => r.json())
      .then((s) => {
        setSeconds(s.seconds);
        setRunning(s.running);
      })
      .catch(() => {});
  }, []);

  // عدّ كل ثانية
  useEffect(() => {
    if (!running) {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
      return;
    }
    tickRef.current = window.setInterval(async () => {
      try {
        await fetch("http://127.0.0.1:8000/api/tick", { method: "POST" });
        const st = await fetch("http://127.0.0.1:8000/api/status").then((r) =>
          r.json()
        );
        setSeconds(st.seconds);
        setRunning(st.running);
      } catch {}
    }, 1000);

    return () => {
      if (tickRef.current) {
        clearInterval(tickRef.current);
        tickRef.current = null;
      }
    };
  }, [running]);

  const start = async () => {
    await fetch("http://127.0.0.1:8000/api/start", { method: "POST" });
    setRunning(true);
  };

  const reset = async () => {
    await fetch("http://127.0.0.1:8000/api/restart", { method: "POST" });
    setRunning(false);
    setSeconds(25 * 60);
  };

  const mm = String(Math.floor(seconds / 60)).padStart(2, "0");
  const ss = String(seconds % 60).padStart(2, "0");

  return (
    <div className="timer-container">
      <div className="timer-display">
        {mm}:{ss}
      </div>
      <div className="timer-buttons">
        <button className="start-btn" onClick={start} disabled={running}>
          Start
        </button>
        <button className="reset-btn" onClick={reset}>Reset</button>
      </div>
    </div>
  );
}

/* ========= الصفحة الواحدة ========= */
export default function OnePage() {
  const { hash } = useLocation();

  // سكرول ناعم
  useEffect(() => {
    const prev = document.documentElement.style.scrollBehavior;
    document.documentElement.style.scrollBehavior = "smooth";
    return () => {
      document.documentElement.style.scrollBehavior = prev;
    };
  }, []);

  // القفز للهاش
  useEffect(() => {
    const id = (hash || "").slice(1);
    if (!id) return;
    document
      .getElementById(id)
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [hash]);

   // تفعيل الهايلايت تلقائياً حسب السكول (نحدّث الهاش بدون تراكم في التاريخ)
  useEffect(() => {
    const ids = ["dashboard", "focus", "group"];
    const sections = ids
      .map((id) => document.getElementById(id))
      .filter(Boolean) as HTMLElement[];

    if (!sections.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        // خذ القسم الأكثر ظهوراً في الشاشة
        const visible = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => b.intersectionRatio - a.intersectionRatio)[0];
        if (!visible) return;

        const currentId = `#${visible.target.id}`;
        if (location.hash !== currentId) {
          history.replaceState(null, "", currentId); // يحدّث الهاش → Sidebar يتحدّث تلقائياً
        }
      },
      { root: null, threshold: [0.5, 0.7, 0.9] } // لازم يظهر ≥50% عشان يتفعّل
    );

    sections.forEach((sec) => observer.observe(sec));
    return () => observer.disconnect();
  }, []);

  return (
    <div className="shell">
      <aside className="shell-aside">
        <Sidebar />
      </aside>

      <main className="shell-main">
        <div className="content">
          <Section id="dashboard" title="Your Dashboard">
            <Dashboard />
          </Section>

          <Section id="focus" title="Focus Timer">
            <FocusTimer />
          </Section>

          <Section id="group" title="Group Challenge">
            <Challenges />
          </Section>
        </div>
      </main>
    </div>
  );
}
