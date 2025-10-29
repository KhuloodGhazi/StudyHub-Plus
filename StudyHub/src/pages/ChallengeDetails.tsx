import "../css/ChallengeDetails.css";
import { useParams, useNavigate } from "react-router-dom";
import React from "react";
import { useAuth } from "../contexts/AuthContext";

export default function ChallengeDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();

  // هنا لاحقًا تقدر تجيب بيانات التحدي من الـ API باستخدام الـ id
  // مؤقتًا بنستخدم مثال بسيط
  const [challenge, setChallenge] = React.useState<any | null>(null);
  const [loading, setLoading] = React.useState<boolean>(true);
  const [error, setError] = React.useState<string>("");

  const currentUserId =
    (user as any)?.id ?? Number(localStorage.getItem("user_id")) ?? 1;
  const currentUserName = user?.name || "Guest";

  // جلب بيانات التحدي الفعلية
  React.useEffect(() => {
    if (!id) return;
    setLoading(true);
    fetch(`http://127.0.0.1:8000/api/challenges/${id}`)
      .then(async (res) => {
        if (!res.ok) {
          let msg = "Failed to load challenge";
          try {
            const j = await res.json();
            msg = j?.detail || msg;
          } catch {}
          throw new Error(msg);
        }
        return res.json();
      })
      .then((data) => {
        setChallenge(data);
        setError("");
      })
      .catch((e) => setError(String(e.message || e)))
      .finally(() => setLoading(false));
  }, [id]);

  // أزرار الانضمام/المغادرة (نفس منطق الصفحة الرئيسية، بدون كسر شغل البنات)
  const handleJoin = async () => {
    if (!challenge) return;
    // إضافة تفاؤلية بسيطة
    setChallenge((prev: any) =>
      prev
        ? {
            ...prev,
            participants: Array.isArray(prev.participants)
              ? Array.from(new Set([...prev.participants, currentUserName]))
              : [currentUserName],
          }
        : prev
    );

    try {
      const res = await fetch(
        `http://127.0.0.1:8000/api/challenges/${challenge.id}/join`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ user_name: currentUserName }),
        }
      );
      if (!res.ok) {
        let msg = "Join failed";
        try {
          const j = await res.json();
          msg = j?.detail || msg;
        } catch {}
        throw new Error(msg);
      }
      // مزامنة هادئة
      const fresh = await fetch(
        `http://127.0.0.1:8000/api/challenges/${challenge.id}`
      ).then((r) => r.json());
      setChallenge(fresh);
    } catch (e: any) {
      // رول-باك
      setChallenge((prev: any) =>
        prev
          ? {
              ...prev,
              participants: Array.isArray(prev.participants)
                ? prev.participants.filter(
                    (p: any) => p !== currentUserName && p !== currentUserId
                  )
                : [],
            }
          : prev
      );
      alert(e?.message || e);
    }
  };

  const handleLeave = async () => {
    if (!challenge) return;

    // إزالة تفاؤلية
    setChallenge((prev: any) =>
      prev
        ? {
            ...prev,
            participants: Array.isArray(prev.participants)
              ? prev.participants.filter(
                  (p: any) => p !== currentUserName && p !== currentUserId
                )
              : [],
          }
        : prev
    );

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
        let msg = "Leave failed";
        try {
          const j = await res.json();
          msg = j?.detail || msg;
        } catch {}
        throw new Error(msg);
      }
      // تحديث بعد النجاح
      const fresh = await fetch(
        `http://127.0.0.1:8000/api/challenges/${challenge.id}`
      ).then((r) => r.json());
      setChallenge(fresh);
    } catch (e: any) {
      // رول-باك (رجّع المستخدم)
      setChallenge((prev: any) =>
        prev
          ? {
              ...prev,
              participants: Array.isArray(prev.participants)
                ? Array.from(new Set([...prev.participants, currentUserName]))
                : [currentUserName],
            }
          : prev
      );
      alert(e?.message || e);
    }
  };

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

  // هل المستخدم منضم؟ (ندعم الاسم أو الـ id أو رقم كنص)
  const participantsArray: any[] = Array.isArray(challenge.participants)
    ? challenge.participants
    : [];
  const isJoined = participantsArray.some(
    (p) => p === currentUserName || String(p) === String(currentUserId)
  );

  const groupProgress = challenge.group_progress ?? 0;
  const userProgress = challenge.user_progress ?? 0;

  const currentCount = participantsArray.length || 0;
  const maxCount = challenge.max_participants ?? 0;
  const isFull = maxCount > 0 && currentCount >= maxCount;

  return (
    <div className={`challenge-details ${challenge.level?.toLowerCase?.() || ""}`}>
      <button className="back-btn" onClick={() => navigate(-1)}>
        ← Back to Challenges
      </button>

      <h1>{challenge.title}</h1>

      <div className="details-info">
        <p className="creator">By {challenge.creator_name}</p>
        <div className="level">
          <span className="material-icons">bar_chart</span>
          {challenge.level} Level
        </div>
        <p className="dates">
          {(challenge.start_date ?? "")} → {(challenge.end_date ?? "")}
        </p>
      </div>

      <p className="challenge-description">{challenge.description}</p>

      {/* شريط التقدّم */}
      <div className="progress-section">
        {/* ✅ "You Progress" يظهر فقط إذا المستخدم منضم */}
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
            className="progress-fill"
            style={{ width: `${groupProgress}%` }}
          ></div>
        </div>
      </div>

      {/* معلومات إضافية مختصرة للمستخدم قبل الانضمام */}
      <div className="meta-counters" style={{ marginTop: 16, marginBottom: 10 }}>
        <div className="participants-row">
          <span className="material-icons">group</span>
          <p style={{ marginLeft: 6 }}>
            {currentCount}/{maxCount} Participants
          </p>
        </div>
      </div>

      <div className="requirements">
        <h3>Requirements</h3>
        <ul>
          {(challenge.tasks || []).map((req: string, index: number) => (
            <li key={`${challenge.id}-req-${index}`}>
              <span className="material-icons">check_circle</span>
              {req}
            </li>
          ))}
        </ul>
      </div>

      {/* زر الانضمام/المغادرة أسفل الصفحة */}
      <div style={{ marginTop: 24 }}>
        {!isJoined ? (
          <button
            className={`save-btn ${challenge.level?.toLowerCase?.() || ""}`}
            style={{ width: "100%" }}
            onClick={handleJoin}
            disabled={isFull}
          >
            {isFull ? "Full" : "Join Challenge"}
          </button>
        ) : (
          <button
            className={`cancel-btn`}
            style={{ width: "100%" }}
            onClick={handleLeave}
          >
            Leave Challenge
          </button>
        )}
      </div>
    </div>
  );
}
