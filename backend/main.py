from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from models.base import engine, Base
from sqlalchemy import text
from models.song import Song
from models.user import User
from models.album import Album
from models.artist import Artist
from models.album_artists import AlbumArtist
from models.playlist import Playlist
from models.playlist_user import PlaylistUser
from models.playlist_tracks import PlaylistTracks
from models.activity_log import ActivityLog
from models.listening_history import ListeningHistory
from models.plan import Plan
from models.subscription import Subscription
from models.payment import Payment
from models.notification_log import NotificationLog
from models.social import (
    SocialComment,
    SocialBlock,
    SocialFollow,
    SocialFriendRequest,
    SocialFriendship,
    SocialLike,
    SocialMessage,
    SocialMute,
    SocialPost,
    SocialShare,
    SocialStory,
    SocialStoryComment,
    SocialStoryCommentLike,
    SocialStoryLike,
    SocialStoryView,
)
from models.song_purchase import SongPurchase
from routes.auth_routes import router as auth_router
from routes.music_routes import router as music_router
from routes.user_routes import router as user_router
from routes.table_routes import router as database_router
from routes.social_routes import router as social_router
from utils.billing import ensure_default_plans
from models.base import SessionLocal
import os

app = FastAPI()
UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",  # Development
        "http://localhost:3001",  # Development alternate port
        "https://kis-music-streaming-9l1lm6io6-hunganh1310s-projects.vercel.app",
        "https://20251-it-4409-web-technologies.vercel.app",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

Base.metadata.create_all(bind=engine)

with engine.begin() as conn:
    conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS account_type VARCHAR NOT NULL DEFAULT 'free'"))
    conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE"))
    conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS is_muted BOOLEAN NOT NULL DEFAULT FALSE"))
    conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_picture_url VARCHAR"))
    conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS cover_photo_url VARCHAR"))
    conn.execute(text("ALTER TABLE users ADD COLUMN IF NOT EXISTS profile_background_color VARCHAR NOT NULL DEFAULT '#1877f2'"))
    conn.execute(text("ALTER TABLE songs ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE"))
    conn.execute(text("ALTER TABLE albums ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE"))
    conn.execute(text("ALTER TABLE artists ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE"))
    conn.execute(text("ALTER TABLE payments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW()"))
    conn.execute(text("ALTER TABLE songs ADD COLUMN IF NOT EXISTS lyrics TEXT"))
    conn.execute(text("ALTER TABLE songs ADD COLUMN IF NOT EXISTS audio_url VARCHAR"))
    conn.execute(text("ALTER TABLE songs ADD COLUMN IF NOT EXISTS approval_status VARCHAR NOT NULL DEFAULT 'approved'"))
    conn.execute(text("ALTER TABLE songs ADD COLUMN IF NOT EXISTS uploaded_by_user_id VARCHAR"))
    conn.execute(text("ALTER TABLE songs ADD COLUMN IF NOT EXISTS rejection_reason VARCHAR"))
    conn.execute(text("ALTER TABLE artists ADD COLUMN IF NOT EXISTS owner_user_id VARCHAR"))
    conn.execute(text("ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS image_url VARCHAR"))
    conn.execute(text("ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS media_url VARCHAR"))
    conn.execute(text("ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS media_type VARCHAR NOT NULL DEFAULT 'image'"))
    conn.execute(text("ALTER TABLE social_stories ADD COLUMN IF NOT EXISTS story_type VARCHAR NOT NULL DEFAULT 'story'"))
    conn.execute(text("ALTER TABLE social_stories ADD COLUMN IF NOT EXISTS media_url VARCHAR"))
    conn.execute(text("ALTER TABLE social_stories ADD COLUMN IF NOT EXISTS media_type VARCHAR NOT NULL DEFAULT 'image'"))
    conn.execute(text("ALTER TABLE social_posts ADD COLUMN IF NOT EXISTS audience VARCHAR NOT NULL DEFAULT 'public'"))
    conn.execute(text("ALTER TABLE social_stories ADD COLUMN IF NOT EXISTS audience VARCHAR NOT NULL DEFAULT 'public'"))
    conn.execute(text("ALTER TABLE social_story_comments ADD COLUMN IF NOT EXISTS parent_comment_id VARCHAR"))
    conn.execute(text("ALTER TABLE social_messages ADD COLUMN IF NOT EXISTS deleted_by_sender BOOLEAN NOT NULL DEFAULT FALSE"))
    conn.execute(text("ALTER TABLE social_messages ADD COLUMN IF NOT EXISTS deleted_by_recipient BOOLEAN NOT NULL DEFAULT FALSE"))
    conn.execute(text("ALTER TABLE song_purchases ADD COLUMN IF NOT EXISTS amount INTEGER NOT NULL DEFAULT 15000"))
    conn.execute(text("ALTER TABLE song_purchases ADD COLUMN IF NOT EXISTS currency VARCHAR NOT NULL DEFAULT 'VND'"))
    conn.execute(text("ALTER TABLE song_purchases ADD COLUMN IF NOT EXISTS status VARCHAR NOT NULL DEFAULT 'owned'"))

db = SessionLocal()
try:
    ensure_default_plans(db)
finally:
    db.close()

app.include_router(auth_router, prefix="/api/auth")
app.include_router(music_router, prefix="/api/music")
app.include_router(user_router, prefix="/api/user")
app.include_router(database_router, prefix="/api/database")
app.include_router(social_router, prefix="/api/social")

@app.get("/")
def root():
    return {"message": "Testing OK"}
