import React, { useEffect, useState } from "react";
import "../css/Challenges.css";
import { useAuth } from "../contexts/AuthContext";
import ChallengeModal from "../components/ChallengeModal";
import { useNavigate } from "react-router-dom";

export default function Challenges() {
  const [challenges, setChallenges] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState("browse");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingChallenge, setEditingChallenge] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string>("");
  const { user } = useAuth();
  const navigate = useNavigate();

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2200);
  };

  const fetchChallenges = () => {
    setLoading(true);
    fetch("http://127.0.0.1:8000/api/challenges")
      .then((res) => res.json())
      .then((data) => setChallenges(data))
      .catch(() => showToast("Failed to load challenges"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchChallenges();
  }, []);

  const openModal = () => setIsModalOpen(true);
  const closeModal = () => {
    setIsModalOpen(false);
    setEditingChallenge(null);
  };

  const handleSaveChallenge = (data: any) => {
    const method = editingChallenge ? "PUT" : "POST";
    const url = editingChallenge
      ? `http://127.0.0.1:8000/api/challenges/${editingChallenge.id}`
      : "http://127.0.0.1:8000/api/challenges";

    setLoading(true);
    fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    })
      .then((res) => res.json())
      .then(() => {
        fetchChallenges();
        closeModal();
        showToast("Saved");
      })
      .catch(() => showToast("Save failed"))
      .finally(() => setLoading(false));
  };

  // helper للتعامل مع ردود غير JSON
  const safeJSON = async (
    res: Response
  ): Promise<{ detail?: string; message?: string } | null> => {
    try {
      const ct = res.headers.get("content-type") || "";
      if (ct.includes("application/json")) {
        return (await res.json()) as { detail?: string; message?: string };
      }
    } catch {}
    return null;
  };

  // ===== Join: إضافة فورية + مزامنة =====
  const handleJoin = (id: number) => {
    const currentUser = user?.name || "Guest";

    // إضافة فورية محليًا + تحويل لتبويب My
    setChallenges((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              participants: Array.isArray(c.participants)
                ? Array.from(new Set([...c.participants, currentUser]))
                : [currentUser],
            }
          : c
      )
    );
    setActiveTab("my");
    showToast("Joined");

    // استدعاء API
    setLoading(true);
    fetch(`http://127.0.0.1:8000/api/challenges/${id}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_name: currentUser }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const data = await safeJSON(res);
          const msg =
            (data?.detail && typeof data.detail === "string" && data.detail) ||
            (data?.message &&
              typeof data.message === "string" &&
              data.message) ||
            "Join failed";
          throw new Error(msg);
        }
        await safeJSON(res);
      })
      .then(() => {
        fetchChallenges(); // مزامنة هادئة
      })
      .catch((e) => {
        // رول-باك
        setChallenges((prev) =>
          prev.map((c) =>
            c.id === id
              ? {
                  ...c,
                  participants: Array.isArray(c.participants)
                    ? c.participants.filter((p: string) => p !== currentUser)
                    : [],
                }
              : c
          )
        );
        showToast(String(e.message || e));
      })
      .finally(() => setLoading(false));
  };

  // ===== Leave: DELETE + body { user_name } مع رول-باك =====
  const handleLeave = (id: number) => {
    const currentUser = user?.name || "Guest";

    // إزالة محلية تفاؤلية
    setChallenges((prev) =>
      prev.map((c) =>
        c.id === id
          ? {
              ...c,
              participants: Array.isArray(c.participants)
                ? c.participants.filter((p: string) => p !== currentUser)
                : [],
            }
          : c
      )
    );

    setLoading(true);
    fetch(`http://127.0.0.1:8000/api/challenges/${id}/leave`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ user_name: currentUser }),
    })
      .then(async (res) => {
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(data.detail || "Leave failed");
        }
        return res.json().catch(() => ({}));
      })
      .then(() => {
        showToast("Left");
        fetchChallenges(); // مزامنة مع السيرفر
      })
      .catch((e) => {
        showToast(`${e.message}`);
        // رول-باك لو فشل
        setChallenges((prev) =>
          prev.map((c) =>
            c.id === id
              ? {
                  ...c,
                  participants: Array.isArray(c.participants)
                    ? Array.from(new Set([...c.participants, currentUser]))
                    : [currentUser],
                }
              : c
          )
        );
      })
      .finally(() => setLoading(false));
  };

  const handleEdit = (c: any) => {
    setEditingChallenge(c);
    setIsModalOpen(true);
  };

  const handleDelete = (id: number) => {
    if (!confirm("Delete this challenge?")) return;
    setLoading(true);
    fetch(`http://127.0.0.1:8000/api/challenges/${id}`, { method: "DELETE" })
      .then(() => {
        fetchChallenges();
        showToast("Deleted");
      })
      .catch(() => showToast("Delete failed"))
      .finally(() => setLoading(false));
  };

  // تبويب "My" = ما أنشأته أو انضممت له
  const filtered =
    activeTab === "my"
      ? challenges.filter(
          (c) =>
            c.creator_name === (user?.name || "Guest") ||
            (Array.isArray(c.participants) &&
              c.participants.includes(user?.name || "Guest"))
        )
      : challenges;

  return (
    <div className="challenges-container">
      <div className="challenges-header">
        <h1>Challenges</h1>
        <button className="create-btn" onClick={openModal}>
          + Create New
        </button>
      </div>

      <div className="tabs">
        <button
          className={activeTab === "browse" ? "tab active" : "tab"}
          onClick={() => setActiveTab("browse")}
        >
          Browse All
        </button>
        <button
          className={activeTab === "my" ? "tab active" : "tab"}
          onClick={() => setActiveTab("my")}
        >
          My Challenges
        </button>
      </div>

      {loading && <div className="spinner" />}

      <div className="challenge-grid">
        {filtered.map((c) => {
          const currentUser = user?.name || "Guest";
          const isOwner = c.creator_name === currentUser;
          const isMember =
            Array.isArray(c.participants) &&
            c.participants.includes(currentUser);

          // نظهر "You Progress" فقط للمالك أو العضو
          const showUserProgress = isOwner || isMember;

          // التعامل مع الامتلاء سواء participants Array أو رقم
          const isFull = Array.isArray(c.participants)
            ? c.participants.length >= c.max_participants
            : (c.participants ?? 0) >= c.max_participants;

          // قيم مؤقتة إن ما وصلتنا من الباك
          const userProgress = c.user_progress ?? 40;

          // ===== منطق Placeholder للـ Group Progress (Demo) =====
          const participantsCount = Array.isArray(c.participants)
            ? c.participants.length
            : 0;
          const groupProgressRaw =
            typeof c.group_progress === "number" &&
            !Number.isNaN(c.group_progress)
              ? c.group_progress
              : 0;
          // لو ما فيه مشاركين وما فيه أي تقدم محسوب → اعرض 70 شكل تجريبي
          const groupProgress =
            participantsCount === 0 && groupProgressRaw === 0
              ? 70
              : groupProgressRaw;

          return (
            <div
              className={`challenge-card ${c.level?.toLowerCase()}`}
              key={c.id}
              onClick={() => navigate(`/challenges/${c.id}`)}
              style={{ cursor: "pointer" }}
            >
              <h2>{c.title}</h2>

              <div className="creator-level-row">
                <p className="creator">By {c.creator_name}</p>
                <div className="level-row">
                  <span className="material-icons level-icon">bar_chart</span>
                  <p>{c.level} Level</p>
                </div>
              </div>

              <p className="desc">{c.description}</p>

              <div className="participants-row">
                <span className="material-icons">group</span>
                <p>Total {c.max_participants} Participants</p>
              </div>

              <div className="awards-row">
                <span className="material-icons">emoji_events</span>
                <p>There are awards when you’re done</p>
              </div>

              {/* ===== شريط التقدم ===== */}
              <div className="progress-section">
                {/* التقدم الفردي → يظهر فقط للمالك أو العضو */}
                {showUserProgress && (
                  <div className="progress-row">
                    <div className="progress-label">
                      <span>You Progress</span>
                      <span className="progress-percent">
                        {userProgress}%
                      </span>
                    </div>
                    <div className="progress-bar">
                      <div
                        className="progress-fill user"
                        style={{ width: `${userProgress}%` }}
                      ></div>
                    </div>
                  </div>
                )}

                {/* التقدم الجماعي → للجميع */}
                <div className="progress-row">
                  <div className="progress-label">
                    <span>Group Progress</span>
                    <span className="progress-percent">
                      {groupProgress}%
                    </span>
                  </div>
                  <div className="progress-bar">
                    <div
                      className="progress-fill group"
                      style={{ width: `${groupProgress}%` }}
                    ></div>
                  </div>
                </div>
              </div>

              <div className="requirements-section">
                <h4>Requirements</h4>
                <ul className="requirements-list">
                  {Array.isArray(c.tasks) &&
                    c.tasks.map((task: string, idx: number) => (
                      <li key={`${c.id}-task-${idx}`}>
                        <span className="material-icons">check_circle</span>
                        <span>{task}</span>
                      </li>
                    ))}
                </ul>
              </div>

              {/* ===== الأزرار ===== */}
              <div
                className="card-actions"
                onClick={(e) => e.stopPropagation()}
              >
                {isOwner ? (
                  <>
                    <button className="edit-btn" onClick={() => handleEdit(c)}>
                      Edit
                    </button>
                    <button
                      className="delete-btn"
                      onClick={() => handleDelete(c.id)}
                    >
                      Delete
                    </button>
                  </>
                ) : isMember ? (
                  <button
                    className={`leave-btn ${c.level?.toLowerCase()}`}
                    onClick={() => handleLeave(c.id)}
                  >
                    Leave Challenge
                  </button>
                ) : isFull ? (
                  <button className="join-btn full" disabled>
                    Full
                  </button>
                ) : (
                  <button
                    className="join-btn"
                    onClick={() => handleJoin(c.id)}
                  >
                    Join Challenge
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      <ChallengeModal
        isOpen={isModalOpen}
        onClose={closeModal}
        onSave={handleSaveChallenge}
        {...(editingChallenge ? { initialData: editingChallenge } : {})}
      />

      {toast && <div className="toast">{toast}</div>}
    </div>
  );
}
