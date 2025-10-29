from sqlalchemy import Column, Integer, String, Text, ForeignKey, Float
from sqlalchemy.orm import relationship
from sqlalchemy.types import JSON
from .database import Base

class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, nullable=False)
    email = Column(String, unique=True, index=True, nullable=False)
    password = Column(String, nullable=False)
    challenges_created = relationship("Challenge", back_populates="creator")


# (Challenge Table)

class Challenge(Base):
    __tablename__ = "challenges"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String, nullable=False)
    description = Column(Text, nullable=True)
    level = Column(String, nullable=True)
    creator_name = Column(String, nullable=False)
    start_date = Column(String, nullable=True)
    end_date = Column(String, nullable=True)

    # ✅ JSON + default=list عشان ما نستخدم [] المشتركة بين كل الصفوف
    participants = Column(JSON, default=list)
    # participants = Column(Integer, default=0)

    max_participants = Column(Integer, nullable=False, default=10)

    # ✅ نفس الفكرة للمهام
    tasks = Column(JSON, default=list)

    # ✅ default=dict بدل {} لتفادي mutable default
    progress = Column(JSON, default=dict)

    # ✅ نخزن كنسبة float (الكود يحسب round(..., 2))
    group_progress = Column(Float, default=0.0)

    creator_id = Column(Integer, ForeignKey("users.id"))
    creator = relationship("User", back_populates="challenges_created")