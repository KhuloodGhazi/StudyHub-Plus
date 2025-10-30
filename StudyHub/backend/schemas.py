from pydantic import BaseModel
from typing import Optional, List, Dict, Union

class UserCreate(BaseModel):
    name: str
    email: str
    password: str


class UserResponse(BaseModel):
    id: int
    name: str
    email: str

    class Config:
        orm_mode = True


# (Request Body)
class ChallengeCreate(BaseModel):
    title: str
    description: Optional[str] = None
    level: Optional[str] = None
    creator_name: str
    start_date: Optional[str] = None
    end_date: Optional[str] = None
    max_participants: int = 1

    #  تعديل: استخدم default_factory بدل [] لتفادي mutable default
    tasks: Optional[List[str]] = []
    participants: Optional[List[Union[int, str]]] = []
    progress: Optional[Dict[str, float]] = {}
    group_progress: Optional[float] = 0.0


# (Response Body)
class ChallengeResponse(BaseModel):
    id: int
    title: str
    description: Optional[str]
    level: Optional[str]
    creator_name: str
    start_date: Optional[str]
    end_date: Optional[str]

    # تعديل: السماح بقائمة IDs أو أسماء
    participants: Optional[List[Union[int, str]]]
    max_participants: int
    tasks: Optional[List[str]]
    progress: Optional[Dict[str, float]]
    group_progress: Optional[float]

    class Config:
        orm_mode = True


# (JOIN)
class ChallengeJoin(BaseModel):
    username: str
