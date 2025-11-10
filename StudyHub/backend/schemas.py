# backend/schemas.py

from pydantic import BaseModel, Field, ConfigDict
from typing import Optional, List, Dict, Union

# =========================
# Users
# =========================
class UserCreate(BaseModel):
    name: str
    email: str
    password: str

class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    name: str
    email: str

class LoginRequest(BaseModel):
    email: str
    password: str


# =========================
# Challenges
# =========================
class TaskItem(BaseModel):
    title: str
    done: bool = False

# طلب الإنشاء/التعديل
class ChallengeCreate(BaseModel):
    title: str
    description: Optional[str] = None
    level: Optional[str] = None
    creator_name: str
    creator_id: Optional[int] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    max_participants: int = Field(default=1, ge=1)

    # مرنة: task كنص أو كائن، مع default_factory لتفادي mutable defaults
    tasks: List[Union[TaskItem, str]] = Field(default_factory=list)

    # مرنة: participants أرقام أو أسماء
    participants: List[Union[int, str]] = Field(default_factory=list)

    # تقدم المستخدمين { "userKey": 0..100 }
    progress: Dict[str, float] = Field(default_factory=dict)

    # تقدم المجموعة %
    group_progress: float = 0.0

# استجابة القراءة
class ChallengeResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: int
    title: str
    description: Optional[str] = None
    level: Optional[str] = None
    creator_name: str
    creator_id: Optional[int] = None
    start_date: Optional[str] = None
    end_date: Optional[str] = None

    max_participants: int
    participants: Optional[List[Union[int, str]]] = None
    participants_count: Optional[int] = None

    tasks: Optional[List[Union[TaskItem, str]]] = None
    progress: Optional[Dict[str, float]] = None
    group_progress: Optional[float] = None

    # حقول اختيارية للـ UI (قد تحسب في السيرفر)
    status: Optional[str] = None
    is_creator: Optional[bool] = None
    is_joined: Optional[bool] = None


# انضمام (للتماشي مع نسخة قديمة لو احتجتي)
class ChallengeJoin(BaseModel):
    username: str


# =========================
# Progress / Tasks APIs
# =========================
class ProgressIn(BaseModel):
    user_id: int
    progress: float


# =========================
# Comments
# =========================
class CommentResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    challenge_id: int
    user_id: int
    user_name: Optional[str] = None
    content: str
    timestamp: str


# =========================
# Timer (للـ Focus Timer)
# =========================
class TimerResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    user_id: int
    seconds: int
    running: bool
