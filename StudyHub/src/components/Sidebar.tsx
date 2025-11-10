import logo from "../assets/images/StudyHub Logo.png";
import "../css/Sidebar.css";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useEffect, useState, MouseEvent } from "react";

const SECTIONS: Array<{ id: "dashboard" | "focus" | "group"; icon: string; label: string }> = [
  { id: "dashboard", icon: "grid_view", label: "Dashboard" },
  { id: "focus",     icon: "timer",     label: "Focus Timer" },
  { id: "group",     icon: "groups",    label: "Group Challenge" },
];

export default function Sidebar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const [active, setActive] = useState<string>("");

  const inOnePage = location.pathname.startsWith("/app");

  // تحديد الهايلايت أول ما تتغير المسارات/الهواش
  useEffect(() => {
    const hash = location.hash || "";
    if (inOnePage) {
      setActive(hash || "#dashboard");
    } else if (location.pathname === "/dashboard") {
      setActive("#dashboard");
    } else if (location.pathname.startsWith("/challenges")) {
      setActive("#group");
    } else if (location.pathname === "/focus") {
      setActive("#focus");
    } else {
      setActive("");
    }
  }, [location.pathname, location.hash, inOnePage]);

  // Scroll-Spy داخل /app: يحدّث الهايلايت تلقائي مع السحب بالماوس
  useEffect(() => {
    if (!inOnePage) return;

    const ids = SECTIONS.map(s => s.id);
    const observers: IntersectionObserver[] = [];
    const options: IntersectionObserverInit = { root: null, rootMargin: "0px 0px -70% 0px", threshold: 0 };

    ids.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      const obs = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) setActive(`#${id}`);
        });
      }, options);
      obs.observe(el);
      observers.push(obs);
    });

    return () => observers.forEach(o => o.disconnect());
  }, [inOnePage]);

  // تنقّل بالهاش داخل /app مع scrollIntoView، وخارج /app يظل لينك عادي
  const handleHashNav = (e: MouseEvent, id: "dashboard" | "focus" | "group") => {
    const hash = `#${id}`;
    setActive(hash);

    if (inOnePage) {
      e.preventDefault();
      if (location.hash !== hash) {
        history.replaceState(null, "", hash);
      }
      document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      // خارج /app خلّيه يروح لـ /app#id ثم اسحب بشكل لطيف بعد التنقل
      setTimeout(() => {
        document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 80);
    }
  };

  const handleLogout = () => {
    setUser?.(null);
    navigate("/");
  };

  return (
    <div className="sidebar">
      <div className="logo">
        <img src={logo} alt="StudyHub+" className="logo-img" />
      </div>

      <nav className="nav-links">
        {SECTIONS.map((s) => (
          <Link
            key={s.id}
            to={`/app#${s.id}`}
            onClick={(e) => handleHashNav(e, s.id)}
            className={`nav-item ${active === `#${s.id}` ? "active" : ""}`}
          >
            <span className="material-icons">{s.icon}</span>
            <p>{s.label}</p>
          </Link>
        ))}
      </nav>

      <div className="logout" onClick={handleLogout}>
        <span className="material-icons">logout</span>
        <p>Logout</p>
      </div>
    </div>
  );
}
