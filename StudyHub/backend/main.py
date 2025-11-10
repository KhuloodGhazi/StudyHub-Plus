from fastapi import FastAPI, Depends, HTTPException, Body, Query
from fastapi.middleware.cors import CORSMiddleware
from passlib.context import CryptContext
from sqlalchemy.orm import Session
from typing import Optional, List, Dict, Any, Union
from datetime import datetime
import json
from pathlib import Path

from . import models, schemas
from .database import engine, SessionLocal

# ===== DB bootstrap
models.Base.metadata.create_all(bind=engine)

# ===== App
app = FastAPI()
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ===== DB dep
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# ===== (اختياري) dump تجريبي للتسجيل
DB_FILE = Path("db.json")
def save_to_json(data):
    try:
        content = {"users": []}
        if DB_FILE.exists():
            content = json.loads(DB_FILE.read_text())
        content.setdefault("users", []).append(data)
        DB_FILE.write_text(json.dumps(content, indent=2))
    except Exception:
        pass

# ===== Helpers
def _now_utc_iso() -> str:
    return datetime.utcnow().isoformat() + "Z"

def _compute_status(start: Optional[str], end: Optional[str]) -> Optional[str]:
    if not start or not end:
        return None
    try:
        today = datetime.utcnow().date()
        s = datetime.fromisoformat(start).date()
        e = datetime.fromisoformat(end).date()
        if today < s:
            return "Upcoming"
        if s <= today <= e:
            return "Active"
        return "Ended"
    except Exception:
        return None

def _as_list(x) -> List[Any]:
    if isinstance(x, list):
        return x
    return [] if x is None else [x]

def _participants_count(ch: models.Challenge) -> int:
    return len(_as_list(ch.participants))

def _is_joined(ch: models.Challenge, user_id: Optional[int], user_name: Optional[str]) -> bool:
    arr = _as_list(ch.participants)
    sid = str(user_id) if user_id is not None else None
    for p in arr:
        if user_id is not None and (p == user_id or (isinstance(p, str) and p.isdigit() and int(p) == user_id)):
            return True
        if user_name and p == user_name:
            return True
        if sid and p == sid:
            return True
    return False

def serialize_challenge(
    ch: models.Challenge,
    current_user_id: Optional[int] = None,
    current_user_name: Optional[str] = None,
) -> Dict[str, Any]:
    return {
        "id": ch.id,
        "title": ch.title,
        "description": ch.description,
        "level": ch.level,
        "creator_name": ch.creator_name,
        "creator_id": ch.creator_id,
        "start_date": ch.start_date,
        "end_date": ch.end_date,
        "max_participants": ch.max_participants,
        "participants": ch.participants,
        "participants_count": _participants_count(ch),
        "tasks": ch.tasks,
        "progress": ch.progress,
        "group_progress": ch.group_progress,
        "status": _compute_status(ch.start_date, ch.end_date),
        "is_creator": (current_user_id is not None and ch.creator_id == current_user_id),
        "is_joined": _is_joined(ch, current_user_id, current_user_name),
    }

# =========================
# Root
# =========================
@app.get("/")
def root():
    return {"message": "FastAPI backend is working!"}

# =========================
# Auth
# =========================
@app.post("/api/register")
def register(user: schemas.UserCreate, db: Session = Depends(get_db)):
    exists = db.query(models.User).filter(models.User.email == user.email).first()
    if exists:
        raise HTTPException(status_code=400, detail="Email already registered")
    hashed = pwd_context.hash(user.password)
    new_u = models.User(name=user.name, email=user.email, password=hashed)
    db.add(new_u)
    db.commit()
    db.refresh(new_u)
    save_to_json({"name": user.name, "email": user.email, "password": user.password})  # تجريبي
    return {"message": "User registered successfully", "name": new_u.name, "id": new_u.id}

@app.post("/api/login")
def login(body: schemas.LoginRequest, db: Session = Depends(get_db)):
    u = db.query(models.User).filter(models.User.email == body.email).first()
    if not u or not pwd_context.verify(body.password, u.password):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return {"message": "Login successful", "user": {"id": u.id, "name": u.name, "email": u.email}}

# =========================
# Challenges CRUD
# =========================
@app.post("/api/challenges", response_model=schemas.ChallengeResponse)
def create_challenge(ch: schemas.ChallengeCreate, db: Session = Depends(get_db)):
    new_ch = models.Challenge(
        title=ch.title,
        description=ch.description,
        level=ch.level,
        creator_name=ch.creator_name,
        creator_id=ch.creator_id,
        start_date=ch.start_date,
        end_date=ch.end_date,
        participants=ch.participants or [],
        max_participants=ch.max_participants,
        tasks=ch.tasks or [],
        progress=ch.progress or {},
        group_progress=ch.group_progress or 0.0,
    )
    db.add(new_ch)
    db.commit()
    db.refresh(new_ch)
    return new_ch

@app.get("/api/challenges", response_model=List[schemas.ChallengeResponse])
def get_challenges(
    user_id: Optional[int] = Query(None),
    user_name: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    rows = db.query(models.Challenge).all()
    return [serialize_challenge(r, user_id, user_name) for r in rows]

@app.get("/api/challenges/{challenge_id}", response_model=schemas.ChallengeResponse)
def get_challenge(
    challenge_id: int,
    user_id: Optional[int] = Query(None),
    user_name: Optional[str] = Query(None),
    db: Session = Depends(get_db),
):
    ch = db.query(models.Challenge).filter(models.Challenge.id == challenge_id).first()
    if not ch:
        raise HTTPException(status_code=404, detail="Challenge not found")
    return serialize_challenge(ch, user_id, user_name)

@app.put("/api/challenges/{challenge_id}", response_model=schemas.ChallengeResponse)
def update_challenge(challenge_id: int, payload: schemas.ChallengeCreate, db: Session = Depends(get_db)):
    ch = db.query(models.Challenge).filter(models.Challenge.id == challenge_id).first()
    if not ch:
        raise HTTPException(status_code=404, detail="Challenge not found")

    ch.title = payload.title
    ch.description = payload.description
    ch.level = payload.level
    ch.creator_name = payload.creator_name
    ch.creator_id = payload.creator_id
    ch.start_date = payload.start_date
    ch.end_date = payload.end_date
    ch.max_participants = payload.max_participants
    ch.tasks = payload.tasks or ch.tasks
    if payload.participants:
        ch.participants = payload.participants
    if payload.progress:
        ch.progress = payload.progress
    if payload.group_progress is not None:
        ch.group_progress = payload.group_progress

    db.commit()
    db.refresh(ch)
    return ch

@app.delete("/api/challenges/{challenge_id}")
def delete_challenge(challenge_id: int, db: Session = Depends(get_db)):
    ch = db.query(models.Challenge).filter(models.Challenge.id == challenge_id).first()
    if not ch:
        raise HTTPException(status_code=404, detail="Challenge not found")
    db.delete(ch)
    db.commit()
    return {"message": "Challenge deleted successfully"}

# =========================
# Join / Leave
# =========================
@app.post("/api/challenges/{challenge_id}/join")
def join_challenge(
    challenge_id: int,
    user_id: Optional[int] = Query(None),             # ?user_id=
    payload: Optional[Dict[str, Any]] = Body(None),   # {"user_name": "..."} أو {"username": "..."} أو {"user_id": n}
    db: Session = Depends(get_db),
):
    ch = db.query(models.Challenge).filter(models.Challenge.id == challenge_id).first()
    if not ch:
        raise HTTPException(status_code=404, detail="Challenge not found")

    body_user_id = None
    body_user_name = None
    if isinstance(payload, dict):
        body_user_id = payload.get("user_id")
        body_user_name = payload.get("user_name") or payload.get("username")

    if user_id is None:
        if body_user_id is not None:
            user_id = int(body_user_id)
        elif body_user_name:
            row = db.query(models.User).filter(models.User.name == body_user_name).first()
            if row:
                user_id = row.id

    ident_mode, ident = None, None
    if user_id is not None:
        ident_mode, ident = "id", int(user_id)
    elif body_user_name:
        ident_mode, ident = "name", str(body_user_name).strip()
    else:
        raise HTTPException(status_code=400, detail="user_id or user_name is required")

    participants: List[Union[int, str]] = _as_list(ch.participants)

    if ident_mode == "id":
        normalized: List[int] = []
        for p in participants:
            if isinstance(p, int):
                normalized.append(p)
            elif isinstance(p, str) and p.isdigit():
                normalized.append(int(p))
        participants = normalized
    else:
        participants = [str(p) for p in participants]

    if ident in participants:
        raise HTTPException(status_code=400, detail="User already joined this challenge")

    if ch.max_participants and len(participants) >= ch.max_participants:
        raise HTTPException(status_code=400, detail="This challenge is already full")

    participants.append(ident)
    ch.participants = participants

    if not isinstance(ch.progress, dict):
        ch.progress = {}
    ch.progress.setdefault(str(ident), 0.0)

    db.commit()
    db.refresh(ch)
    return {"message": "Joined successfully", "participants": len(participants)}

@app.delete("/api/challenges/{challenge_id}/leave")
def leave_challenge(
    challenge_id: int,
    user_id: Optional[int] = Query(None),            # ?user_id=
    payload: Optional[Dict[str, Any]] = Body(None),  # {"user_name": "..."} أو {"user_id": n}
    db: Session = Depends(get_db),
):
    ch = db.query(models.Challenge).filter(models.Challenge.id == challenge_id).first()
    if not ch:
        raise HTTPException(status_code=404, detail="Challenge not found")

    body_user_id = None
    body_user_name = None
    if isinstance(payload, dict):
        body_user_id = payload.get("user_id")
        body_user_name = payload.get("user_name") or payload.get("username")

    participants_raw: List[Union[int, str]] = _as_list(ch.participants)
    new_participants: List[Union[int, str]] = []
    removed = False

    for p in participants_raw:
        if isinstance(p, int):
            if (user_id is not None and p == int(user_id)) or (body_user_id is not None and p == int(body_user_id)):
                removed = True
                continue
            new_participants.append(p)
            continue

        if isinstance(p, str):
            if p.isdigit():
                if (user_id is not None and int(p) == int(user_id)) or (body_user_id is not None and int(p) == int(body_user_id)):
                    removed = True
                    continue
            if body_user_name and p == str(body_user_name).strip():
                removed = True
                continue
            new_participants.append(p)
            continue

        new_participants.append(p)

    if not removed:
        raise HTTPException(status_code=400, detail="User not in this challenge")

    ch.participants = new_participants

    if isinstance(ch.progress, dict):
        if user_id is not None:
            ch.progress.pop(str(user_id), None)
        if body_user_id is not None:
            ch.progress.pop(str(body_user_id), None)
        if body_user_name:
            ch.progress.pop(str(body_user_name).strip(), None)

    vals = list(ch.progress.values()) if isinstance(ch.progress, dict) else []
    ch.group_progress = round(sum(vals) / len(vals), 2) if vals else 0.0

    db.commit()
    db.refresh(ch)
    return {"message": "Left challenge successfully", "participants": len(new_participants)}

# =========================
# Progress / Tasks
# =========================
@app.patch("/api/challenges/{challenge_id}/progress")
def update_progress(
    challenge_id: int,
    body: schemas.ProgressIn,                     # JSON: { "user_id": .., "progress": .. }
    db: Session = Depends(get_db),
):
    ch = db.query(models.Challenge).filter(models.Challenge.id == challenge_id).first()
    if not ch:
        raise HTTPException(status_code=404, detail="Challenge not found")

    if not isinstance(ch.progress, dict):
        ch.progress = {}

    ch.progress[str(body.user_id)] = float(body.progress)

    vals = list(ch.progress.values())
    ch.group_progress = round(sum(vals) / len(vals), 2) if vals else 0.0

    db.commit()
    db.refresh(ch)
    return {"message": "Progress updated successfully", "user_progress": ch.progress[str(body.user_id)], "group_progress": ch.group_progress}


# =====================
# 🔹 تعديل منطقة حفظ progress + tasks
# =====================

@app.patch("/api/challenges/{challenge_id}/tasks")
def update_tasks(
    challenge_id: int,
    user_id: Optional[int] = Query(None),
    tasks: List[Union[schemas.TaskItem, str]] = Body(...),
    db: Session = Depends(get_db),
):
    ch = db.query(models.Challenge).filter(models.Challenge.id == challenge_id).first()
    if not ch:
        raise HTTPException(status_code=404, detail="Challenge not found")

    # ✅ نحفظ الـ tasks كاملة (بما فيها حالة done)
    normalized: List[Dict[str, Any]] = []
    for t in tasks:
        if isinstance(t, str):
            normalized.append({"title": t, "done": False})
        elif isinstance(t, dict):
            title = str(t.get("title", "")).strip()
            done = bool(t.get("done", False))
            normalized.append({"title": title, "done": done})
        else:
            continue

    ch.tasks = normalized  # نحفظها مثل ما هي بالضبط

    # ✅ نحسب نسبة إنجاز المستخدم الحالي
    done_count = sum(1 for x in normalized if x.get("done"))
    total = len(normalized) or 1
    pct = round(100.0 * done_count / total, 2)

    # ✅ نحفظ progress الخاص بالمستخدم
    if not isinstance(ch.progress, dict):
        ch.progress = {}

    if user_id is not None:
        ch.progress[str(user_id)] = pct  # نخزن التقدم بدقة

    # ✅ نحسب group progress بناءً على الجميع
    vals = list(ch.progress.values())
    ch.group_progress = round(sum(vals) / len(vals), 2) if vals else pct

    db.commit()
    db.refresh(ch)
    return {
        "message": "Tasks updated",
        "tasks": ch.tasks,
        "user_progress": pct,
        "group_progress": ch.group_progress
    }

# =========================
# Leaderboard
# =========================
@app.get("/api/challenges/{challenge_id}/leaderboard")
def get_leaderboard(challenge_id: int, db: Session = Depends(get_db)):
    ch = db.query(models.Challenge).filter(models.Challenge.id == challenge_id).first()
    if not ch:
        raise HTTPException(status_code=404, detail="Challenge not found")
    lb: List[Dict[str, Any]] = []
    if isinstance(ch.progress, dict):
        for k, v in ch.progress.items():
            lb.append({"id": k, "name": str(k), "progress": float(v)})
    lb.sort(key=lambda x: x["progress"], reverse=True)
    return lb

# =========================
# Comments
# =========================
@app.get("/api/challenges/{challenge_id}/comments", response_model=List[schemas.CommentResponse])
def list_comments(challenge_id: int, db: Session = Depends(get_db)):
    ch = db.query(models.Challenge).filter(models.Challenge.id == challenge_id).first()
    if not ch:
        raise HTTPException(status_code=404, detail="Challenge not found")
    rows = db.query(models.Comment).filter(models.Comment.challenge_id == challenge_id).all()
    out = []
    for r in rows:
        u = db.query(models.User).filter(models.User.id == r.user_id).first()
        out.append({
            "id": r.id,
            "challenge_id": r.challenge_id,
            "user_id": r.user_id,
            "user_name": (u.name if u else None),
            "content": r.content,
            "timestamp": r.timestamp,
        })
    return out

@app.post("/api/challenges/{challenge_id}/comments")
def add_comment(
    challenge_id: int,
    user_id: int = Query(...),
    content: str = Query(...),
    db: Session = Depends(get_db),
):
    ch = db.query(models.Challenge).filter(models.Challenge.id == challenge_id).first()
    if not ch:
        raise HTTPException(status_code=404, detail="Challenge not found")
    ts = _now_utc_iso()
    c = models.Comment(
        challenge_id=challenge_id,
        user_id=user_id,
        content=content,
        timestamp=ts,
    )
    db.add(c)
    db.commit()
    db.refresh(c)
    return {"message": "Comment added", "id": c.id, "timestamp": ts}

@app.delete("/api/comments/{comment_id}")
def delete_comment(comment_id: int, db: Session = Depends(get_db)):
    c = db.query(models.Comment).filter(models.Comment.id == comment_id).first()
    if not c:
        raise HTTPException(status_code=404, detail="Comment not found")
    db.delete(c)
    db.commit()
    return {"message": "Comment deleted"}

# =========================
# Simple Timer (in-memory) — نفس واجهات صديقتك
# =========================
_timer_state = {"seconds": 25 * 60, "running": False}

@app.get("/api/status")
def timer_status():
    return _timer_state

@app.post("/api/start")
def timer_start():
    _timer_state["running"] = True
    return {"ok": True}

@app.post("/api/restart")
def timer_restart():
    _timer_state["seconds"] = 25 * 60
    _timer_state["running"] = False
    return {"ok": True}

@app.get("/api/progress")
def timer_progress():
    total = 25 * 60
    done = total - _timer_state["seconds"]
    percent = int((done / total) * 100)
    return {"progress": percent}

@app.post("/api/tick")
def timer_tick():
    if _timer_state["running"] and _timer_state["seconds"] > 0:
        _timer_state["seconds"] -= 1
    return {"seconds": _timer_state["seconds"]}
