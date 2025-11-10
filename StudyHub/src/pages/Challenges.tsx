import React, { useEffect, useMemo, useState } from "react";
import "../css/Challenges.css";
import { useAuth } from "../contexts/AuthContext";
import ChallengeModal from "../components/ChallengeModal";
import { useNavigate } from "react-router-dom";

type AnyObj = Record<string, any>;
type Challenge = AnyObj;

type Normalized = Challenge & {
  /** داخليًا فقط: IDs للمشاركين */
  _participantIds: number[];
  /** عدّاد المشاركين بعد التطبيع */
  _participantsCount: number;
  /** حالة التحدي لو توفرت */
  _status?: "Upcoming" | "Active" | "Ended" | string;
};

export default function Challenges() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // [FIX] نتعامل مع أنواع مختلفة للمستخدم + fallback من localStorage
  const currentUserId =
    (user as any)?.id ?? Number(localStorage.getItem("user_id")) ?? 0; // [FIX]
  const currentUserName =
    (user as any)?.name ?? localStorage.getItem("username") ?? "Guest"; // [FIX]

  const [raw, setRaw] = useState<Challenge[]>([]);
  const [list, setList] = useState<Normalized[]>([]);
  const [activeTab, setActiveTab] = useState<"browse" | "my">("browse");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingChallenge, setEditingChallenge] = useState<Challenge | null>(null);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState<string>("");

  // ====== Utilities ======
  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2200);
  };

  const safeJSON = async (res: Response) => {
    try {
      const ct = res.headers.get("content-type") || "";
      if (ct.includes("application/json")) return await res.json();
    } catch {}
    return null;
  };

  // participants قد تكون:
  // number[] | string[] | object[] | undefined
  const extractParticipantIds = (c: Challenge): number[] => {
    const src = c?.participants;
    if (!src) return [];
    if (Array.isArray(src)) {
      if (src.length === 0) return [];
      const first = src[0];
      if (typeof first === "number") return Array.from(new Set(src as number[]));
      if (typeof first === "string") {
        return Array.from(
          new Set((src as string[]).map((s) => Number(s)).filter((n) => Number.isFinite(n)))
        );
      }
      if (typeof first === "object" && first) {
        return Array.from(
          new Set(
            (src as AnyObj[])
              .map((p) => Number(p?.id ?? p?.user_id ?? (typeof p === "string" ? p : NaN)))
              .filter((n) => Number.isFinite(n))
          )
        );
      }
    }
    return [];
  };

  const normalizeOne = (c: Challenge): Normalized => {
    const ids = extractParticipantIds(c);
    const pc = typeof c?.participants_count === "number" ? c.participants_count : ids.length;
    const status: Normalized["_status"] = typeof c?.status === "string" ? c.status : undefined;
    return { ...c, _participantIds: ids, _participantsCount: pc, _status: status };
  };

  const normalizeAll = (arr: Challenge[]) => (Array.isArray(arr) ? arr : []).map(normalizeOne);

  // ====== Fetch ======
  const fetchChallenges = () => {
    setLoading(true);
    fetch(`http://127.0.0.1:8000/api/challenges?user_id=${currentUserId}&user_name=${encodeURIComponent(currentUserName)}`) // [CHG] نرسل الاسم أيضاً
      .then(async (res) => (await safeJSON(res)) ?? [])
      .then((data) => {
        setRaw(data);
        setList(normalizeAll(data));
      })
      .catch(() => showToast("Failed to load challenges"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchChallenges();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentUserId]);

  // ====== Derived ======
  const filtered = useMemo(
    () =>
      activeTab === "my"
        ? list.filter((c) => c.creator_id === currentUserId || c._participantIds.includes(currentUserId))
        : list,
    [activeTab, list, currentUserId]
  );

  // ====== Modal ======
  const openModal = () => setIsModalOpen(true);
  const closeModal = () => {
    setIsModalOpen(false);
    setEditingChallenge(null);
  };

  const handleSaveChallenge = (data: AnyObj) => {
    const method = editingChallenge ? "PUT" : "POST";
    const url = editingChallenge
      ? `http://127.0.0.1:8000/api/challenges/${editingChallenge.id}?user_id=${currentUserId}`
      : "http://127.0.0.1:8000/api/challenges";

    // نضمن توافق الباك: نرسل creator_id + creator_name
    const payload = { ...data, creator_id: currentUserId, creator_name: currentUserName };

    setLoading(true);
    fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    })
      .then(async (res) => {
        if (!res.ok) {
          const err = (await safeJSON(res)) || {};
          throw new Error(err.detail || err.message || "Save failed");
        }
        return safeJSON(res);
      })
      .then(() => {
        fetchChallenges();
        closeModal();
        showToast("Saved");
      })
      .catch((e: any) => showToast(String(e.message || e)))
      .finally(() => setLoading(false));
  };

  // ====== Helpers ======
  const isOwner = (c: Normalized) => c.creator_id === currentUserId;
  const isMember = (c: Normalized) => c._participantIds.includes(currentUserId);
  const isFull = (c: Normalized) =>
    typeof c.max_participants === "number" && c._participantsCount >= c.max_participants;

  const userProgressOf = (c: Normalized) => {
    if (c && typeof c.progress === "object" && c.progress) {
      const v = c.progress[String(currentUserId)];
      if (typeof v === "number") return v;
    }
    if (typeof c?.user_progress === "number") return c.user_progress;
    return 0;
  };

  const groupProgressOf = (c: Normalized) => {
    if (typeof c?.group_progress === "number") return c.group_progress;
    return 0;
  };

  // ====== Join / Leave (تفاؤلي + رولباك) ======
  // ====== Join ======
const handleJoin = async (id: number) => {
  // [FIX] إذا ما فيه مستخدم فعلي نخزن قيم مؤقتة
  const tempUserId =
    currentUserId && currentUserId !== 0
      ? currentUserId
      : (() => {
          const fakeId = 999999;
          localStorage.setItem("user_id", String(fakeId));
          return fakeId;
        })();

  const tempUserName =
    currentUserName && currentUserName !== "Guest"
      ? currentUserName
      : (() => {
          const fakeName = "Guest";
          localStorage.setItem("username", fakeName);
          return fakeName;
        })();

  // تفاؤلي: نحدث الواجهة فورًا
  setList((prev) =>
    prev.map((c) =>
      c.id === id
        ? {
            ...c,
            _participantIds: c._participantIds.includes(tempUserId)
              ? c._participantIds
              : [...c._participantIds, tempUserId],
            _participantsCount: c._participantIds.includes(tempUserId)
              ? c._participantsCount
              : c._participantsCount + 1,
          }
        : c
    )
  );

  // ✅ [FIX] نرجع المستخدم مباشرة لتبويب "My Challenges"
  setActiveTab("my"); // هذا السطر يرجّع السلوك القديم

  showToast("Joined");

  setLoading(true);
  try {
    await fetch(
      `http://127.0.0.1:8000/api/challenges/${id}/join?user_id=${tempUserId}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_name: tempUserName }),
      }
    );
    fetchChallenges(); // مزامنة بعد الانضمام
  } catch (e: any) {
    console.error(e);
    showToast("Failed to join");
  } finally {
    setLoading(false);
  }
};

// ====== Leave ======
const handleLeave = async (id: number) => {
  const tempUserId =
    currentUserId && currentUserId !== 0
      ? currentUserId
      : Number(localStorage.getItem("user_id")) || 999999;

  const tempUserName =
    currentUserName && currentUserName !== "Guest"
      ? currentUserName
      : localStorage.getItem("username") || "Guest";

  // تفاؤلي
  setList((prev) =>
    prev.map((c) =>
      c.id === id
        ? {
            ...c,
            _participantIds: c._participantIds.filter((pid) => pid !== tempUserId),
            _participantsCount: Math.max(0, c._participantsCount - 1),
          }
        : c
    )
  );

  showToast("Left");

  setLoading(true);
  try {
    await fetch(
      `http://127.0.0.1:8000/api/challenges/${id}/leave?user_id=${tempUserId}`,
      {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_name: tempUserName }),
      }
    );
    fetchChallenges(); // مزامنة بعد الخروج
  } catch (e: any) {
    console.error(e);
    showToast("Failed to leave");
  } finally {
    setLoading(false);
  }
};


  // ====== Edit/Delete ======
  const handleEdit = (c: Challenge) => {
    setEditingChallenge(c);
    setIsModalOpen(true);
  };

  const handleDelete = (id: number) => {
    if (!confirm("Delete this challenge?")) return;
    setLoading(true);
    fetch(`http://127.0.0.1:8000/api/challenges/${id}?user_id=${currentUserId}`, {
      method: "DELETE",
    })
      .then(async (res) => {
        if (!res.ok) {
          const err = (await safeJSON(res)) || {};
          throw new Error(err.detail || err.message || "Delete failed");
        }
        showToast("Deleted");
        fetchChallenges();
      })
      .catch((e: any) => showToast(String(e.message || e)))
      .finally(() => setLoading(false));
  };

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
          const owner = isOwner(c);
          const member = isMember(c);
          const isJoined = member; // [ADD] اسم أوضح للاستخدام أسفل
          const showUserProgress = owner || member;

          const uProg = userProgressOf(c);
          const gProg = groupProgressOf(c);
          const full = isFull(c);

          const statusClass =
            c._status === "Active" ? "active" : c._status === "Ended" ? "ended" : c._status ? "upcoming" : "";

          const renderTask = (t: any) => (typeof t === "string" ? t : t?.title ?? "");
          const isDone = (t: any) => (typeof t === "object" && t ? Boolean(t.done) : false);

          return (
            <div
              className={`challenge-card ${c.level?.toLowerCase?.() || ""}`}
              key={c.id}
              onClick={() => !loading && navigate(`/challenges/${c.id}`)}
              style={{ cursor: loading ? "not-allowed" : "pointer" }}
            >
              <div className="card-header">
                {c._status && <span className={`status-badge ${statusClass}`}>{c._status}</span>}
                <h2 className="challenge-title">{c.title}</h2>
              </div>

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
                <p>Total {c._participantsCount} Participants</p>
              </div>

              <div className="awards-row">
                <span className="material-icons">emoji_events</span>
                <p>There are awards when you’re done</p>
              </div>

              {/* ===== Progress ===== */}
              <div className="progress-section">
                {showUserProgress && (
                  <div className="progress-row">
                    <div className="progress-label">
                      <span>Your Progress</span>
                      <span className="progress-percent">{uProg}%</span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill user" style={{ width: `${uProg}%` }} />
                    </div>
                  </div>
                )}

                <div className="progress-row">
                  <div className="progress-label">
                    <span>Group Progress</span>
                    <span className="progress-percent">{gProg}%</span>
                  </div>
                  <div className="progress-bar">
                    <div className="progress-fill group" style={{ width: `${gProg}%` }} />
                  </div>
                </div>
              </div>

              {/* ===== Requirements / Tasks ===== */}
              <div className="requirements-section">
                <h4>Requirements</h4>
                <ul className="requirements-list">
                  {Array.isArray(c.tasks) &&
                    c.tasks.map((task: any, idx: number) => (
                      <li key={`${c.id}-task-${idx}`}>
                        <span className="material-icons">
                          {isDone(task) ? "check_circle" : "radio_button_unchecked"}
                        </span>
                        <span>{renderTask(task)}</span>
                      </li>
                    ))}
                </ul>
              </div>

              {/* ===== Actions ===== */}
              <div className="card-actions" onClick={(e) => e.stopPropagation()}>
                {owner ? (
                  <>
                    <button className="edit-btn" onClick={() => handleEdit(c)}>
                      Edit
                    </button>
                    <button className="delete-btn" onClick={() => handleDelete(c.id)}>
                      Delete
                    </button>

                    {/* [ADD] المالك يقدر ينضم/يخرج كباقي المستخدمين */}
                    {!isJoined && !full && (
                      <button className="join-btn" onClick={() => handleJoin(c.id)} disabled={loading}>
                         {loading ? "Joining..." : "Join"}
                      </button>
                    )}
                    {isJoined && (
                      <button
                        className={`leave-btn ${c.level?.toLowerCase?.() || ""}`}
                        onClick={() => handleLeave(c.id)}
                        disabled={loading}
                      >
                        {loading ? "Leaving..." : "Leave"}
                      </button>
                    )}
                    {full && !isJoined && <button className="join-btn full" disabled>Full</button>}
                  </>
                ) : isJoined ? (
                  <button
                    className={`leave-btn ${c.level?.toLowerCase?.() || ""}`}
                    onClick={() => handleLeave(c.id)}
                    disabled={loading}
                  >
                    {loading ? "Leaving..." : "Leave Challenge"}
                  </button>
                ) : full ? (
                  <button className="join-btn full" disabled>
                    Full
                  </button>
                ) : (
                  <button className="join-btn" onClick={() => handleJoin(c.id)} disabled={loading}>
                    {loading ? "Joining..." : "Join Challenge"}
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
