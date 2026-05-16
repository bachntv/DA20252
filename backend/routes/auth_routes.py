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

### Config
load_dotenv("backend/.env")

SECRET_KEY = os.getenv("SECRET_KEY")
ALGORITHM = os.getenv("ALGORITHM")
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES"))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS"))


router = APIRouter()
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/signin")


### Database dependency
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


### JWT helper
def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    expire = datetime.utcnow() + (expires_delta or timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES))
    # expire = datetime.utcnow() + (expires_delta or timedelta(minutes=2))
    to_encode = data.copy()
    to_encode.update({"exp": expire})
    # print(f"Token creat at: {datetime.utcnow()}")
    # print(f"Token expires at: {expire}")
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


def create_refresh_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS))
    # expire = datetime.utcnow() + (expires_delta or timedelta(minutes=3))

    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


###
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
    return user
### Authenticated user dependency
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
    return user


### Signup route
@router.post("/signup", response_model=UserResponse)
def signup(user: UserCreate, db: Session = Depends(get_db)):
    existing = db.query(User).filter(User.email == user.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already registered")

    new_user = User(
        username=user.username,
        email=user.email,
        hashed_password=hash_password(user.password),
        birthdate=user.birthdate,
        gender=user.gender,
        # roles="admin"
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)  # now new_user.id is ready
    subscription = ensure_user_has_subscription(db, new_user)
    plan = get_subscription_plan(db, subscription)
    new_user.account_type = plan.code
    db.commit()
    db.refresh(new_user)

    # Create default playlist
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


### Signin route (returns token)
@router.post("/signin")
def signin(credentials: UserLogin, response: Response, db: Session = Depends(get_db)):
    user = (
        db.query(User)
        .filter(
            (User.email == credentials.identifier)
            | (User.username == credentials.identifier)
        )
        .first()
    )
    if not user or not verify_password(credentials.password, user.hashed_password):
        raise HTTPException(status_code=401, detail="Invalid username/email or password")

    subscription = ensure_user_has_subscription(db, user)
    plan = get_subscription_plan(db, subscription)
    user.account_type = plan.code
    db.commit()
    log_activity(db, user.id, "signin", "user", user.id, f"Signed in with {plan.name} plan")

    access_token = create_access_token(data={
        "sub": str(user.id),
        "roles": user.roles.split(",") if user.roles else ["user"],
        "account_type": user.account_type,
    })
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
    return {
        "access_token": access_token,
        "token_type": "bearer",
        "user": {
            "id": user.id,
            "username": user.username,
            "email": user.email,
            "roles": user.roles,
            "account_type": user.account_type,
        },
    }

### Refresh token route
@router.post("/refresh-token")
def refresh_token(request: Request, response: Response, db: Session = Depends(get_db)):
    refresh_token = request.cookies.get("refresh_token")
    if not refresh_token:
        raise HTTPException(status_code=401, detail="No refresh token provided")

    try:
        payload = jwt.decode(refresh_token, SECRET_KEY, algorithms=[ALGORITHM])
        userId: str = payload.get("userId")
        if userId is None:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid token")

    user = db.query(User).filter(User.id == userId).first()
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")

    subscription = ensure_user_has_subscription(db, user)
    plan = get_subscription_plan(db, subscription)
    user.account_type = plan.code
    db.commit()
    log_activity(db, user.id, "refresh_token", "user", user.id, f"Refreshed session as {plan.name}")

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
        },
    }

@router.post("/logout")
def logout(response: Response):
    response.delete_cookie("refresh_token")
    return {"message": "Logged out"}

### Protected test route
@router.get("/home")
def get_home(user: User = Depends(get_current_user)):
    return {"message": f"Welcome back, {user.username}!"}
