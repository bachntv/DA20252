from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import date

class UserCreate(BaseModel):
    username: str
    email: EmailStr
    password: str
    birthdate: date
    gender: Optional[str]
    account_role: Optional[str] = "user"

class UserResponse(BaseModel):
    id: str
    username: str
    email: EmailStr
    birthdate: date
    gender: Optional[str]
    account_type: Optional[str] = "free"
    profile_picture_url: Optional[str] = None
    cover_photo_url: Optional[str] = None
    profile_background_color: Optional[str] = "#1877f2"

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
    profile_picture_url: Optional[str] = None
    cover_photo_url: Optional[str] = None
    profile_background_color: Optional[str] = None
