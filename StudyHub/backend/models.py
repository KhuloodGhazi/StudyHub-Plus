from sqlalchemy import Column, Integer, String, Text, ForeignKey, Float, Boolean
from sqlalchemy.orm import relationship
from sqlalchemy.types import JSON
from .database import Base


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password = Column(String, nullable=False)

    # علاقات
    challenges_created = relationship(
        "Challenge",
        back_populates="creator",
        cascade="all, delete-orphan",
    )
    comments = relationship(
        "Comment",
        back_populates="user",
        cascade="all, delete-orphan",
    )
    timers = relationship(
        "Timer",
        back_populates="user",
        cascade="all, delete-orphan",
    )

    def __repr__(self):
        return f"<User(id={self.id}, name={self.name}, email={self.email})>"


class Timer(Base):
    __tablename__ = "timers"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    seconds = Column(Integer, default=1500)  # 25 minutes
    running = Column(Boolean, default=False)

    user = relationship("User", back_populates="timers")

    def __repr__(self):
        return f"<Timer(id={self.id}, user_id={self.user_id}, seconds={self.seconds}, running={self.running})>"


class Challenge(Base):
    __tablename__ = "challenges"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    level = Column(String, nullable=True)
    creator_name = Column(String, nullable=False)
    start_date = Column(String, nullable=True)
    end_date = Column(String, nullable=True)

    # JSON fields (مرنة للعرض والتخزين المؤقت)
    participants = Column(JSON, default=list)   # يدعم IDs أو أسماء حسب الواجهة
    max_participants = Column(Integer, nullable=False, default=10)
    tasks = Column(JSON, default=list)          # عناصر قد تكون {"title","done"} أو نص
    progress = Column(JSON, default=dict)       # مفتاحه user_id أو الاسم؛ القيمة نسبة %
    group_progress = Column(Float, default=0.0)

    # مالك التحدي
    creator_id = Column(Integer, ForeignKey("users.id"))
    creator = relationship("User", back_populates="challenges_created")

    # تعليقات بعلاقة نظامية (أنظف من JSON)
    comments = relationship(
        "Comment",
        back_populates="challenge",
        cascade="all, delete-orphan",
    )

    def __repr__(self):
        return f"<Challenge(id={self.id}, title={self.title}, level={self.level}, creator={self.creator_name})>"


class Comment(Base):
    __tablename__ = "comments"

    id = Column(Integer, primary_key=True, index=True)
    challenge_id = Column(Integer, ForeignKey("challenges.id"), nullable=False)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    content = Column(Text, nullable=False)
    timestamp = Column(String, nullable=False)

    challenge = relationship("Challenge", back_populates="comments")
    user = relationship("User", back_populates="comments")

    def __repr__(self):
        return f"<Comment(id={self.id}, user_id={self.user_id}, challenge_id={self.challenge_id})>"
