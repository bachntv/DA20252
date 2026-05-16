from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import date

class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    birthdate: date
    gender: Optional[str]

class UserResponse(BaseModel):
    id: str
    username: str
    email: EmailStr
    birthdate: date
    gender: Optional[str]
    account_type: Optional[str] = "free"

    class Config:
        orm_mode = True

class UserLogin(BaseModel):
    identifier: str  # can be email or username
    password: str

class UserUpdate(BaseModel):
    username: Optional[str]
    email: Optional[EmailStr]
    birthdate: Optional[date]
    gender: Optional[str]
    account_type: Optional[str] = None
