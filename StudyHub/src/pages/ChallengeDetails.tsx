// src/pages/ChallengeDetails.tsx
import "../css/ChallengeDetails.css";
import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

// يدعم string أو {title,done}
type Task = string | { title?: string; done?: boolean };

type LeaderRow = { id: number; name: string; progress: number };
type CommentRow = { id: number; user_name: string; content: string; timestamp: string };

export default function ChallengeDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  // حالة الصفحة
  const [challenge, setChallenge] = React.useState<any | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState("");
  const [updating, setUpdating] = React.useState(false);

  // تبويبات
  const [activeTab, setActiveTab] = React.useState<"details" | "leaderboard" | "comments">("details");
  const [leaderboard, setLeaderboard] = React.useState<LeaderRow[]>([]);
  const [loadingLeaderboard, setLoadingLeaderboard] = React.useState(false);

  const [comments, setComments] = React.useState<CommentRow[]>([]);
  const [newComment, setNewComment] = React.useState("");
  const [loadingComments, setLoadingComments] = React.useState(false);

  // المستخدم الحالي
  const currentUserId =
    (user as any)?.id ?? Number(localStorage.getItem("user_id")) ?? 0;
  const currentUserName =
    user?.name || localStorage.getItem("username") || "Guest";

  // ---------- جلب آمن يقبل النسختين من الباك ----------
  async function fetchChallengeSafe() {
    if (!id) return;
    setLoading(true);
    setError("");

    try {
      // جرّب نسخة صاحبتك (تحتاج user_id للـ flags)
      let url = `http://127.0.0.1:8000/api/challenges/${id}?user_id=${currentUserId}&user_name=${encodeURIComponent(
        currentUserName
      )}`;
      let res = await fetch(url);

      if (!res.ok) {
        // fallback لنسختك الأبسط
        url = `http://127.0.0.1:8000/api/challenges/${id}`;
        res = await fetch(url);
      }

      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.detail || `Failed (status ${res.status})`);
      }

      const data = await res.json();
      setChallenge(data);
    } catch (e: any) {
      setError(String(e.message || e));
    } finally {
      setLoading(false);
    }
  }

  React.useEffect(() => {
    fetchChallengeSafe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ---------- تطبيع البيانات للعرض بأمان ----------
  const participantsArray: any[] = Array.isArray(challenge?.participants)
    ? challenge.participants
    : [];

  // يدعم {id,name} أو رقم أو نص
  const participantIds = participantsArray
    .map((p) =>
      typeof p === "object" && p !== null
        ? (p as any).id
        : typeof p === "number"
        ? p
        : Number.isFinite(+p)
        ? +p
        : null
    )
    .filter(Boolean) as number[];

  const participantNames = participantsArray
    .map((p) =>
      typeof p === "object" && p !== null
        ? (p as any).name
        : typeof p === "string"
        ? p
        : null
    )
    .filter(Boolean) as string[];

  const isJoined =
    participantIds.includes(currentUserId) ||
    participantNames.includes(currentUserName);

  const rawTasks: Task[] = Array.isArray(challenge?.tasks) ? challenge.tasks : [];
  const tasks = rawTasks.map((t) =>
    typeof t === "string" ? { title: t, done: false } : t || { title: "", done: false }
  );

  const progressMap =
    (typeof challenge?.progress === "object" && challenge?.progress) || {};
  const userProgress =
    progressMap[String(currentUserId)] ??
    (typeof challenge?.user_progress === "number" ? challenge.user_progress : 0);
  const groupProgress = Number.isFinite(challenge?.group_progress)
    ? challenge.group_progress
    : 0;

  const currentCount =
    challenge?.participants_count ??
    participantsArray.length ??
    0;
  const maxCount = challenge?.max_participants ?? 0;
  const isFull = maxCount > 0 && currentCount >= maxCount;

  // [CHG] احسب نسبة إنجاز المستخدم محليًا من مصفوفة المهام
  function computeUserProgress(arr: { title?: string; done?: boolean }[]) {
    const total = arr.length;
    if (total === 0) return 0;
    const done = arr.filter((t) => t && t.done === true).length;
    return Math.round((done / total) * 100);
  }
  // [CHG] يضمن تحديث progress بدون اعتماد على استجابة فورية من الخادم
  // [CHG] ويضمن النتيجة نفسها بعد إعادة الجلب

  // ---------- أزرار الانضمام/المغادرة ----------
  async function handleJoin() {
    if (!challenge) return;
    setUpdating(true);

    // [CHG] تحديث تفاؤلي لحالة الانضمام والعداد
    setChallenge((prev: any) => {
      if (!prev) return prev;
      const already = participantIds.includes(currentUserId) || participantNames.includes(currentUserName);
      if (already) return prev;
      const nextCount =
        typeof prev.participants_count === "number"
          ? prev.participants_count + 1
          : (participantsArray?.length || 0) + 1;
      return { ...prev, is_joined: true, participants_count: nextCount };
    });
    // [CHG] حتى لو فشل الطلب، بنرجع نزامن من الخادم بعده

    try {
      const res = await fetch(
        `http://127.0.0.1:8000/api/challenges/${challenge.id}/join?user_id=${currentUserId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_name: currentUserName }),
        }
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.detail || "Join failed");
      }
    } catch (e: any) {
      // [CHG] في حال فشل الانضمام نرجع نزامن من الخادم (يرجع الحالة الصحيحة)
    } finally {
      await fetchChallengeSafe(); // [CHG] مزامنة مضمونة للحالة
      setUpdating(false);
    }
  }

  async function handleLeave() {
    if (!challenge) return;
    setUpdating(true);

    // [CHG] تحديث تفاؤلي لحالة المغادرة والعداد
    setChallenge((prev: any) => {
      if (!prev) return prev;
      const nextCount =
        typeof prev.participants_count === "number"
          ? Math.max(0, prev.participants_count - 1)
          : Math.max(0, (participantsArray?.length || 0) - 1);
      return { ...prev, is_joined: false, participants_count: nextCount };
    });

    try {
      const res = await fetch(
        `http://127.0.0.1:8000/api/challenges/${challenge.id}/leave?user_id=${currentUserId}`,
        {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_name: currentUserName }),
        }
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.detail || "Leave failed");
      }
    } catch (e: any) {
      // [CHG] لو فشل، المزامنة بترجع الحالة الصحيحة
    } finally {
      await fetchChallengeSafe(); // [CHG] مزامنة أكيدة
      setUpdating(false);
    }
  }

  // ---------- التوجّه/التحميل ----------
  if (loading) {
    return (
      <div className="challenge-details">
        <button className="back-btn" onClick={() => navigate(-1)}>
          ← Back to Challenges
        </button>
        <p>Loading...</p>
      </div>
    );
  }

  if (error || !challenge) {
    return (
      <div className="challenge-details">
        <button className="back-btn" onClick={() => navigate(-1)}>
          ← Back to Challenges
        </button>
        <p style={{ color: "#c0392b" }}>{error || "Challenge not found"}</p>
      </div>
    );
  }

  // ---------- تبويب: المتصدرين ----------
  async function fetchLeaderboard() {
    if (!id) return;
    setLoadingLeaderboard(true);
    try {
      const res = await fetch(
        `http://127.0.0.1:8000/api/challenges/${id}/leaderboard`
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.detail || "Failed to load leaderboard");
      }
      const data = await res.json();
      setLeaderboard(Array.isArray(data) ? data : []);
    } catch {
      // نكتفي بالصمت
    } finally {
      setLoadingLeaderboard(false);
    }
  }

  // ---------- تبويب: التعليقات ----------
  async function fetchComments() {
    if (!id) return;
    setLoadingComments(true);
    try {
      const res = await fetch(
        `http://127.0.0.1:8000/api/challenges/${id}/comments`
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.detail || "Failed to load comments");
      }
      const data = await res.json();
      setComments(Array.isArray(data) ? data : []);
    } catch {
      // نكتفي بالصمت
    } finally {
      setLoadingComments(false);
    }
  }

  async function handleAddComment() {
    if (!newComment.trim()) return;
    try {
      const res = await fetch(
        `http://127.0.0.1:8000/api/challenges/${id}/comments?user_id=${currentUserId}&content=${encodeURIComponent(
          newComment.trim()
        )}`,
        { method: "POST" }
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.detail || "Failed to add comment");
      }
      setNewComment("");
      await fetchComments();
    } catch (e: any) {
      alert(e.message || e);
    }
  }

  async function handleDeleteComment(commentId: number) {
    if (!window.confirm("Delete this comment?")) return;
    try {
      const res = await fetch(
        `http://127.0.0.1:8000/api/comments/${commentId}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.detail || "Failed to delete comment");
      }
      await fetchComments();
    } catch (e: any) {
      alert(e.message || e);
    }
  }

  // ---------- تبويب: المهام (toggle) + نقل المنتهي لآخر القائمة + حفظ دائم ----------
  async function handleToggleTask(index: number, isDone: boolean) {
    if (!challenge) return;
    if (!isJoined) return; // نمنع الغير منضم

    // [CHG] نبني نسخة جديدة من المهام ككائنات {title,done}
    const asObjects = tasks.map((t) => ({ title: t.title || "", done: !!t.done })); // [CHG]
    asObjects[index] = { ...asObjects[index], done: !isDone }; // [CHG] قلب الحالة

    // [CHG] فرز: المنتهية (done:true) تنزل آخر القائمة
    const pending = asObjects.filter((t) => !t.done);
    const finished = asObjects.filter((t) => t.done);
    const reordered = [...pending, ...finished]; // [CHG]

    // [CHG] احسب تقدّم المستخدم الجديد
    const newUserProgress = computeUserProgress(reordered); // [CHG]

    // [CHG] تحديث تفاؤلي على الواجهة
    setChallenge((prev: any) => {
      if (!prev) return prev;
      const nextProgress = { ...(prev.progress || {}) };
      nextProgress[String(currentUserId)] = newUserProgress;
      return { ...prev, tasks: reordered, progress: nextProgress };
    }); // [CHG]

    setUpdating(true);
    try {
      // [CHG] 1) نحفظ المهام + حالة done في الباك (يسحب group_progress داخليًا)
      await fetch(
        `http://127.0.0.1:8000/api/challenges/${challenge.id}/tasks?user_id=${currentUserId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(reordered),
        }
      ).catch(() => { /* لو الباك القديم ما يدعم هذا، بنكمّل بالخطوة 2 */ });

      // [CHG] 2) (توافق) حدّث تقدّم المستخدم صراحةً لو endpoint progress موجود
      await fetch(
        `http://127.0.0.1:8000/api/challenges/${challenge.id}/progress`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_id: currentUserId, progress: newUserProgress }),
        }
      ).catch(() => { /* لو غير متوفر، عادي */ });

      // [CHG] 3) مزامنة نهائية لجلب group_progress والمهام بصيغتها النهائية من الخادم
      await fetchChallengeSafe();
    } catch (e: any) {
      alert(e.message || e);
    } finally {
      setUpdating(false);
    }
  }

  return (
    <div className={`challenge-details ${challenge.level?.toLowerCase?.() || ""}`}>
      <button className="back-btn" onClick={() => navigate(-1)}>
        ← Back to Challenges
      </button>

      <h1>{challenge.title}</h1>

      {/* التبويبات */}
      <div className="tabs-container">
        <button
          className={`tab-btn ${activeTab === "details" ? "active" : ""}`}
          onClick={() => setActiveTab("details")}
        >
          Details
        </button>

        <button
          className={`tab-btn ${activeTab === "leaderboard" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("leaderboard");
            fetchLeaderboard();
          }}
        >
          Leaderboard
        </button>

        <button
          className={`tab-btn ${activeTab === "comments" ? "active" : ""}`}
          onClick={() => {
            setActiveTab("comments");
            fetchComments();
          }}
        >
          Comments
        </button>
      </div>

      {/* تبويب التفاصيل */}
      {activeTab === "details" && (
        <>
          <div className="details-info">
            <p className="creator">By {challenge.creator_name}</p>
            <div className="level">
              <span className="material-icons">bar_chart</span>
              {challenge.level} Level
            </div>
            <p className="dates">
              {challenge.start_date || "—"} → {challenge.end_date || "—"}
            </p>
          </div>

          <p className="challenge-description">
            {challenge.description || "No description provided."}
          </p>

          {/* التقدّم */}
          <div className="progress-section">
            {isJoined && (
              <>
                <div className="progress-label">
                  <span>You Progress</span>
                  <span>{userProgress}%</span>
                </div>
                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{ width: `${userProgress}%` }}
                  ></div>
                </div>
              </>
            )}

            <div className="progress-label" style={{ marginTop: isJoined ? 15 : 0 }}>
              <span>Group Progress</span>
              <span>{groupProgress}%</span>
            </div>
            <div className="progress-bar">
              <div
                className="progress-fill group"
                style={{ width: `${groupProgress}%` }}
              ></div>
            </div>
          </div>

          {/* متطلبات/مهام */}
          <div className="requirements">
            <h3>
              <span className="material-icons">list_alt</span> Requirements
            </h3>

            {tasks.length > 0 ? (
              <ul>
                {tasks.map((task, i) => {
                  const isDone = task.done === true;
                  return (
                    <li
                      key={`${challenge.id}-task-${i}`}
                      onClick={() => handleToggleTask(i, isDone)}
                      className={`task-item ${isDone ? "done" : ""}`}
                      style={{ cursor: isJoined ? "pointer" : "default" }}
                    >
                      <span className="material-icons">
                        {isDone ? "check_circle" : "radio_button_unchecked"}
                      </span>
                      <span>{task.title || ""}</span>
                    </li>
                  );
                })}
              </ul>
            ) : (
              <p style={{ color: "#555" }}>No tasks defined for this challenge.</p>
            )}
          </div>

          {/* زر الانضمام/المغادرة */}
          <div style={{ marginTop: 24 }}>
            {!isJoined ? (
              <button
                className={`save-btn ${challenge.level?.toLowerCase?.() || ""}`}
                style={{ width: "100%" }}
                onClick={handleJoin}
                disabled={isFull || updating}
              >
                {updating ? "Joining..." : isFull ? "Full" : "Join Challenge"}
              </button>
            ) : (
              <button
                className="cancel-btn"
                style={{ width: "100%" }}
                onClick={handleLeave}
                disabled={updating}
              >
                {updating ? "Leaving..." : "Leave Challenge"}
              </button>
            )}
          </div>
        </>
      )}

      {/* تبويب المتصدرين */}
      {activeTab === "leaderboard" && (
        <div className="leaderboard-section">
          <h3>
            <span className="material-icons">emoji_events</span> Leaderboard
          </h3>
          {loadingLeaderboard ? (
            <p>Loading leaderboard...</p>
          ) : leaderboard.length > 0 ? (
            <ul className="leaderboard-list">
              {leaderboard.map((row, idx) => (
                <li key={row.id} className="leaderboard-item">
                  <span className="rank">#{idx + 1}</span>
                  <span className="name">{row.name}</span>
                  <span className="progress">{row.progress}%</span>
                </li>
              ))}
            </ul>
          ) : (
            <p>No participants yet.</p>
          )}
        </div>
      )}

      {/* تبويب التعليقات */}
      {activeTab === "comments" && (
        <div className="comments-section">
          <h3>
            <span className="material-icons">chat</span> Comments
          </h3>

          {loadingComments ? (
            <p>Loading comments...</p>
          ) : comments.length > 0 ? (
            <ul className="comments-list">
              {comments.map((c) => (
                <li key={c.id} className="comment-item">
                  <div className="comment-header">
                    <strong>{c.user_name}</strong>
                    <div className="comment-actions">
                      <span className="timestamp">{c.timestamp}</span>
                      {c.user_name === currentUserName && (
                        <button
                          className="delete-comment-btn"
                          onClick={() => handleDeleteComment(c.id)}
                          title="Delete comment"
                        >
                          <span className="material-icons">delete</span>
                        </button>
                      )}
                    </div>
                  </div>
                  <p>{c.content}</p>
                </li>
              ))}
            </ul>
          ) : (
            <p>No comments yet. Be the first!</p>
          )}

          {isJoined && (
            <div className="comment-form">
              <textarea
                placeholder="Write your comment..."
                value={newComment}
                onChange={(e) => setNewComment(e.target.value)}
              />
              <button onClick={handleAddComment}>Send</button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
