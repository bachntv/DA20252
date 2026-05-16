from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
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
from routes.auth_routes import router as auth_router
from routes.music_routes import router as music_router
from routes.user_routes import router as user_router
from routes.table_routes import router as database_router
from utils.billing import ensure_default_plans
from models.base import SessionLocal

app = FastAPI()

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
    conn.execute(text("ALTER TABLE songs ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE"))
    conn.execute(text("ALTER TABLE albums ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE"))
    conn.execute(text("ALTER TABLE artists ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE"))
    conn.execute(text("ALTER TABLE payments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP NOT NULL DEFAULT NOW()"))

db = SessionLocal()
try:
    ensure_default_plans(db)
finally:
    db.close()

app.include_router(auth_router, prefix="/api/auth")
app.include_router(music_router, prefix="/api/music")
app.include_router(user_router, prefix="/api/user")
app.include_router(database_router, prefix="/api/database")

@app.get("/")
def root():
    return {"message": "Testing OK"}
