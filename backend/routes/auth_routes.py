import os

from fastapi import APIRouter, Depends, HTTPException, Response, Request
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from sqlalchemy.orm import Session
from typing import Optional
from datetime import datetime, timedelta
from jose import jwt, JWTError

from models.base import SessionLocal
from models.user import User
from models.playlist import Playlist
from models.playlist_user import PlaylistUser
from schemas.user import UserCreate, UserResponse, UserLogin
from utils.password import hash_password, verify_password
from utils.billing import ensure_user_has_subscription, get_subscription_plan
from utils.activity import log_activity

from dotenv import load_dotenv

# Doc cau hinh bao mat va thoi gian song cua token tu file .env.
load_dotenv("backend/.env")

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES"))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS"))


router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/signin")


# Mo mot phien lam viec voi database cho moi request, sau do luon dong lai.
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


# Tao access token ngan han. Token nay duoc gui kem khi goi API can dang nhap.
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    # expire = datetime.utcnow() + (expires_delta or timedelta(minutes=2))
    to_encode = data.copy()
    to_encode.update({"exp": expire})
    # print(f"Token creat at: {datetime.utcnow()}")
    # print(f"Token expires at: {expire}")
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token(data: dict, expires_delta: Optional[timedelta] = None):
    # Refresh token song lau hon va chi dung de xin access token moi.
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS))
    # expire = datetime.utcnow() + (expires_delta or timedelta(minutes=3))

    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


# Kiem tra token va dam bao tai khoan co quyen admin.
def get_current_admin_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        roles = payload.get("roles", [])
        if user_id is None or "admin" not in roles:
            raise HTTPException(status_code=403, detail="Admin access required")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = db.query(User).filter(User.id == str(user_id)).first()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is disabled")
    return user


# Kiem tra token va dam bao tai khoan co quyen artist.
def get_current_artist_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        roles = payload.get("roles", [])
        if user_id is None or "artist" not in roles:
            raise HTTPException(status_code=403, detail="Artist access required")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = db.query(User).filter(User.id == str(user_id)).first()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is disabled")
    return user


# Kiem tra access token cua mot nguoi dung da dang nhap.
def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)) -> User:
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        user_id: str = payload.get("sub")
        if user_id is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = db.query(User).filter(User.id == str(user_id)).first()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is disabled")
    return user


# POST /api/auth/signup: tao tai khoan moi.
@router.post("/signup", response_model=UserResponse)
def signup(user: UserCreate, db: Session = Depends(get_db)):
    # Khong cho phep hai tai khoan dung chung mot email.
    existing = db.query(User).filter(User.email == user.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    # Tai khoan artist co ca hai quyen user va artist.
    requested_role = (user.account_role or "user").strip().lower()
    roles = "user,artist" if requested_role == "artist" else "user"

    # Ma hoa mat khau truoc khi luu; database khong luu mat khau goc.
    new_user = User(
        username=user.username,
        email=user.email,
        hashed_password=hash_password(user.password),
        birthdate=user.birthdate,
        gender=user.gender,
        roles=roles,
        # roles="admin"
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)  # now new_user.id is ready
    # Tao goi dich vu mac dinh cho tai khoan vua dang ky.
    subscription = ensure_user_has_subscription(db, new_user)
    plan = get_subscription_plan(db, subscription)
    new_user.account_type = plan.code
    db.commit()
    db.refresh(new_user)

    # Moi tai khoan duoc tao san playlist "Liked Songs".
    liked_playlist = Playlist(
        name="Liked Songs",
        # owner_id=new_user.id,  # Not in DB schema, use playlist_user table instead
        # is_public=False,
        description="Your personal liked songs collection",
        cover_image_url="https://misc.scdn.co/liked-songs/liked-songs-640.png",
    )

    db.add(liked_playlist)
    db.commit()
    db.refresh(liked_playlist)

    playlist_user = PlaylistUser(
        playlist_id=liked_playlist.id,
        user_id=new_user.id,
        type="playlist",
    )

    db.add(playlist_user)
    db.commit()
    log_activity(db, new_user.id, "signup", "user", new_user.id, f"Created account with {plan.name} plan")

    return new_user


# POST /api/auth/signin: kiem tra tai khoan va tra token dang nhap.
@router.post("/signin")
def signin(credentials: UserLogin, response: Response, db: Session = Depends(get_db)):
    # identifier co the la email hoac username.
    user = (
        db.query(User)
        .filter(
            (User.email == credentials.identifier)
            | (User.username == credentials.identifier)
        )
        .first()
    )
    # So san mat khau nguoi dung nhap voi chuoi hashed_password trong database.
    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid username/email or password")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="This account has been disabled")

    # Lay thong tin goi dich vu hien tai de dua vao phien dang nhap.
    subscription = ensure_user_has_subscription(db, user)
    plan = get_subscription_plan(db, subscription)
    user.account_type = plan.code
    db.commit()
    log_activity(db, user.id, "signin", "user", user.id, f"Signed in with {plan.name} plan")

    # Access token chua ID, quyen va loai tai khoan de backend phan quyen.
    access_token = create_access_token(data={
        "sub": str(user.id),
        "roles": user.roles.split(",") if user.roles else ["user"],
        "account_type": user.account_type,
    })
    # Refresh token duoc luu trong cookie HttpOnly, JavaScript khong doc truc tiep.
    refresh_token = create_refresh_token(data={"userId": str(user.id)})
    response.set_cookie(
        key="refresh_token",
        value=refresh_token,
        httponly=True,
        secure=False,
        samesite="lax",
        # path="api/auth/refresh-token",
        expires=timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS),
        # expires=timedelta(minutes=3)
    )
    # Frontend nhan access token va thong tin co ban de luu trang thai dang nhap.
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "roles": user.roles,
            "account_type": user.account_type,
            "profile_picture_url": user.profile_picture_url,
            "cover_photo_url": user.cover_photo_url,
            "profile_background_color": user.profile_background_color,
        },
    }

# POST /api/auth/refresh-token: cap access token moi ma khong bat dang nhap lai.
@router.post("/refresh-token")
def refresh_token(request: Request, response: Response, db: Session = Depends(get_db)):
    # Trinh duyet tu dong gui refresh token trong cookie.
    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token:
        raise HTTPException(status_code=401, detail="No refresh token provided")

    # Giai ma token de lay ID nguoi dung, token sai/het han se bi tu choi.
    try:
        payload = jwt.decode(refresh_token, SECRET_KEY, algorithms=[ALGORITHM])
        userId: str = payload.get("userId")
        if userId is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    # Van phai kiem tra tai khoan con ton tai va dang hoat dong.
    user = db.query(User).filter(User.id == userId).first()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    if not user.is_active:
        raise HTTPException(status_code=403, detail="Account is disabled")

    subscription = ensure_user_has_subscription(db, user)
    plan = get_subscription_plan(db, subscription)
    user.account_type = plan.code
    db.commit()
    log_activity(db, user.id, "refresh_token", "user", user.id, f"Refreshed session as {plan.name}")

    # Tao access token moi voi quyen va goi dich vu moi nhat.
    access_token = create_access_token(data={
        "sub": str(user.id),
        "roles": user.roles.split(",") if user.roles else ["user"],
        "account_type": user.account_type,
    })
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "roles": user.roles,
            "account_type": user.account_type,
            "profile_picture_url": user.profile_picture_url,
            "cover_photo_url": user.cover_photo_url,
            "profile_background_color": user.profile_background_color,
        },
    }

@router.post("/logout")
def logout(response: Response):
    # Dang xuat bang cach xoa refresh token khoi cookie.
    response.delete_cookie("refresh_token")
    return {"message": "Logged out"}

### Protected test route
@router.get("/home")
def get_home(user: User = Depends(get_current_user)):
    return {"message": f"Welcome back, {user.username}!"}
