from fastapi import APIRouter, UploadFile, File, Form, Depends, HTTPException, Query, Body
from typing import List, Union, Optional
from sqlalchemy.orm import Session
from sqlalchemy import text
from models.base import SessionLocal
from models.playlist import Playlist
from models.playlist_user import PlaylistUser
from models.listening_history import ListeningHistory
from schemas.album import AlbumResponse
from schemas.track import TrackResponse
from schemas.user import UserResponse
from schemas.playlist import PlaylistResponse
from schemas.artist import ArtistResponse
from utils.format_ms import format_duration
from collections import defaultdict
from utils.s3_mp3_url import generate_presigned_url
from fastapi.responses import JSONResponse
from datetime import datetime, timezone
from zoneinfo import ZoneInfo
import cloudinary
import cloudinary.uploader
import os
import json
from uuid import uuid4
from dotenv import load_dotenv
from utils.recommender_loader import recommender
import random
from models.user import User
from .auth_routes import get_current_user
import requests
from utils.billing import ensure_user_has_subscription, get_subscription_plan
from utils.activity import log_activity

ASIA_TIMEZONE = ZoneInfo("Asia/Bangkok")

load_dotenv()

# Configure Cloudinary
cloudinary.config(
    cloud_name=os.getenv("CLOUDINARY_NAME"),
    api_key=os.getenv("CLOUDINARY_KEY"),
    api_secret=os.getenv("CLOUDINARY_SECRET"),
    secure=True
)

router = APIRouter()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


@router.post("/user/listening-history")
def record_listening_history(
    track_id: str = Body(..., embed=True),
    source: Optional[str] = Body("player", embed=True),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    track_exists = db.execute(text("""
        SELECT 1
        FROM songs s
        JOIN artists at ON at.id = s.artist_id
        JOIN albums ab ON ab.id = s.album_id
        WHERE s.track_id = :track_id
          AND s.is_active = TRUE
          AND at.is_active = TRUE
          AND ab.is_active = TRUE
        LIMIT 1
    """), {"track_id": track_id}).fetchone()
    if not track_exists:
        raise HTTPException(status_code=404, detail="Track is unavailable")

    entry = ListeningHistory(
        user_id=current_user.id,
        track_id=track_id,
        source=source or "player",
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    log_activity(db, current_user.id, "play_song", "track", track_id, f"Played from {source or 'player'}")
    return {"message": "Listening history recorded", "id": entry.id}


@router.get("/user/listening-history")
def get_listening_history(
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    rows = db.execute(text("""
        SELECT lh.track_id, s.track_name, at.name AS artist_name, s.track_image_url, lh.played_at
        FROM listening_history lh
        JOIN songs s ON s.track_id = lh.track_id
        JOIN artists at ON at.id = s.artist_id
        JOIN albums ab ON ab.id = s.album_id
        WHERE lh.user_id = :user_id
          AND s.is_active = TRUE
          AND at.is_active = TRUE
          AND ab.is_active = TRUE
        ORDER BY lh.played_at DESC
        LIMIT 12
    """), {"user_id": current_user.id}).fetchall()

    history = []
    seen = set()
    for row in rows:
        track_id = row[0]
        if track_id in seen:
            continue
        seen.add(track_id)
        history.append({
            "id": track_id,
            "title": row[1],
            "subtitle": row[2],
            "image": row[3],
            "type": "track",
            "played_at": row[4].isoformat() if row[4] else None,
        })
    return history

### Playlist API
@router.get("/user_playlist", response_model=List[PlaylistResponse])
def get_user_playlists(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    user_id = current_user.id
    query = text("""
        SELECT playlist_user.playlist_id AS id, playlists.name, users.username AS owner_name, playlist_user.type, playlists.cover_image_url, playlists.description, playlist_user.created_at, playlist_user.last_played as last_played
        FROM playlists
        RIGHT JOIN playlist_user ON playlists.id = playlist_user.playlist_id
        INNER JOIN users ON users.id = playlist_user.user_id
        WHERE users.id = :user_id
    """)
    result = db.execute(query, {"user_id": user_id})
    rows = result.fetchall()

    # Convert to list of PlaylistResponse
    playlists = []
    for row in rows:
        playlist_id, name, owner_name, type_, cover, desc, created_at, last_played = row

        if type_ == "artist":
            artist_row = db.execute(text("""
                SELECT name, image_url FROM artists WHERE id = :id AND is_active = TRUE
            """), {"id": playlist_id}).fetchone()
            if not artist_row:
                continue
            if artist_row:
                name, cover = artist_row
                desc = f"Playlist của nghệ sĩ {name}"
        
        elif type_ == "single" or type_ == "composite":
            song_row = db.execute(text("""
                SELECT name, image_url FROM albums WHERE id = :id AND is_active = TRUE
            """), {"id": playlist_id}).fetchone()
            if not song_row:
                continue
            if song_row:
                name, cover = song_row
                desc = f"Single: {name}"

        playlists.append(PlaylistResponse(
            id=playlist_id,
            name=name,
            owner_name=owner_name,
            type=type_,
            cover_image_url=cover,
            description=desc,
            created_at=created_at,
            last_played=last_played
        ))

    return playlists

@router.get("/playlist/{playlist_id}/songs", response_model=List[TrackResponse])
def get_playlist_songs(playlist_id: str, db: Session = Depends(get_db)):
    query = text("""
        SELECT s.track_id, s.track_name, at.id AS artist_id, at.name AS artist_name, ab.id AS album_id, ab.name AS album_name,
               s.duration_ms, s.track_image_url, ps.date_added
        FROM songs s
        INNER JOIN playlist_tracks ps ON s.track_id = ps.track_id
        INNER JOIN playlist_user pu ON pu.playlist_id = ps.playlist_id
        INNER JOIN artists at ON at.id = s.artist_id
        INNER JOIN albums ab ON ab.id = s.album_id
        WHERE ps.playlist_id = :playlist_id
          AND s.is_active = TRUE
          AND at.is_active = TRUE
          AND ab.is_active = TRUE
    """)
    result = db.execute(query, {"playlist_id": playlist_id})
    rows = result.fetchall()

    if not rows:
        raise HTTPException(status_code=404, detail="No songs found in this playlist")

    # Aggregate artists by track
    track_map = defaultdict(lambda: {
        "id": None,
        "title": None,
        "artist_id": set(),
        "artists": set(),
        "album_id": None,
        "album": None,
        "duration": None,
        "cover_url": None,
        "date_added": None,
    })

    for row in rows:
        track_id = row[0]
        track = track_map[track_id]
        track["id"] = track_id
        track["title"] = row[1]
        track["artist_id"].add(row[2])
        track["artists"].add(row[3])
        track["album_id"] = row[4]
        track["album"] = row[5]
        track["duration"] = format_duration(row[6])
        track["cover_url"] = row[7]
        track["date_added"] = row[8]

    return [
        TrackResponse(
            id=track["id"],
            title=track["title"],
            artist_id=", ".join(sorted(track["artist_id"])),
            artist=", ".join(sorted(track["artists"])),
            album_id=track["album_id"],
            album=track["album"],
            duration=track["duration"],
            cover_url=track["cover_url"],
            date_added=track["date_added"].isoformat() if track["date_added"] else None
        )
        for track in track_map.values()
    ]

@router.get("/playlist/{playlist_id}", response_model=PlaylistResponse)
def get_playlist_info(playlist_id: str, db: Session = Depends(get_db)):
    query = text("""
        SELECT 
            playlists.id,
            playlists.name,
            users.username AS owner_name,
            playlist_user.type,
            playlists.cover_image_url,
            playlists.description,
            playlist_user.created_at,
            playlist_user.last_played
        FROM playlists
        INNER JOIN playlist_user ON playlists.id = playlist_user.playlist_id
        INNER JOIN users ON users.id = playlist_user.user_id
        WHERE playlists.id = :playlist_id
        LIMIT 1
    """)
    result = db.execute(query, {"playlist_id": playlist_id}).fetchone()

    if not result:
        raise HTTPException(status_code=404, detail="Playlist not found")

    return PlaylistResponse(
        id=result[0],
        name=result[1],
        owner_name=result[2],
        type=result[3],
        cover_image_url=result[4],
        description=result[5],
        created_at=result[6],
        last_played=result[7]
    )

@router.put("/playlist/{playlist_id}/edit")
async def update_playlist(
    playlist_id: str,
    name: str = Form(None),
    description: str = Form(None),
    cover_image: UploadFile = File(None),
    db: Session = Depends(get_db)
):
    playlist = db.query(Playlist).filter(Playlist.id == playlist_id).first()
    if not playlist:
        raise HTTPException(status_code=404, detail="Playlist not found")

    if name is not None:
        playlist.name = name
    if description is not None:
        playlist.description = description
    if cover_image:
        try:
            upload_result = cloudinary.uploader.upload(
                cover_image.file,
                folder=f"playlist_covers/{playlist_id}",
                public_id="cover",
                resource_type="image"
            )
            playlist.cover_image_url = upload_result.get("secure_url")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Upload failed: {str(e)}")

    db.commit()
    db.refresh(playlist)
    return {"message": "Playlist updated", "cover_image_url": playlist.cover_image_url}

@router.delete("/user_playlist/{playlist_id}")
def delete_playlist(playlist_id: str, db: Session = Depends(get_db),current_user: User = Depends(get_current_user)):
    user_id = current_user.id
    # First delete all songs from the playlist
    db.execute(text("""
        DELETE FROM playlist_tracks
        WHERE playlist_id = :playlist_id
    """), {"playlist_id": playlist_id})

    # Then delete the playlist-user association
    db.execute(text("""
        DELETE FROM playlist_user
        WHERE playlist_id = :playlist_id AND user_id = :user_id
    """), {"playlist_id": playlist_id, "user_id": user_id})

    # Then delete the playlist itself
    result = db.execute(text("""
        DELETE FROM playlists
        WHERE id = :playlist_id AND owner_id = :user_id
    """), {"playlist_id": playlist_id, "user_id": user_id})

    db.commit()

    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Playlist not found or not owned by user")

    return {"message": "Playlist deleted successfully"}

@router.post("/user/create_playlist")
async def create_playlist(
    # user_id: str,
    name: str = Form(...),
    description: str = Form(""),
    cover_image: UploadFile = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    user_id = current_user.id
    subscription = ensure_user_has_subscription(db, current_user)
    plan = get_subscription_plan(db, subscription)
    current_playlist_count = (
        db.query(PlaylistUser)
        .filter(PlaylistUser.user_id == user_id, PlaylistUser.type == "playlist")
        .count()
    )
    if current_playlist_count >= plan.max_playlists:
        raise HTTPException(
            status_code=403,
            detail=f"Your {plan.name} plan supports up to {plan.max_playlists} playlists only."
        )

    playlist_id = str(uuid4())
    cover_url = None

    if cover_image:
        try:
            upload_result = cloudinary.uploader.upload(
                cover_image.file,
                folder=f"user_{user_id}/playlist_covers/{playlist_id}",
                public_id="cover",
                resource_type="image"
            )
            cover_url = upload_result.get("secure_url")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Cloudinary upload failed: {str(e)}")

    # Create playlist
    playlist = Playlist(
        id=playlist_id,
        name=name,
        description=description,
        cover_image_url=cover_url,
        # is_public=True,
        # last_played=None,
        owner_id=user_id
    )
    db.add(playlist)
    db.add(PlaylistUser(user_id=user_id, playlist_id=playlist_id, type="playlist"))
    db.commit()
    log_activity(db, user_id, "create_playlist", "playlist", playlist_id, f"Created playlist: {name}")

    return {
        "id": playlist_id,
        "name": name,
        "description": description,
        "cover_image_url": cover_url
    }

@router.delete("/playlist/{playlist_id}/remove_track")
def remove_track_from_playlist(
    playlist_id: str,
    track_id: str = Query(...),
    db: Session = Depends(get_db)
):
    delete_query = text("""
        DELETE FROM playlist_tracks
        WHERE playlist_id = :playlist_id AND track_id = :track_id
    """)
    result = db.execute(delete_query, {
        "playlist_id": playlist_id,
        "track_id": track_id
    })
    db.commit()

    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Track not found in playlist")

    return {"message": "Track removed from playlist"}

### Album API

@router.get("/album/{album_id}", response_model=AlbumResponse)
def get_album_by_id(album_id: str, db: Session = Depends(get_db)):
    query = text("""
        SELECT ab.id, ab.name, ab.image_url, ab.release_date, at.name, aa.artist_id
        FROM albums ab
        INNER JOIN album_artists aa ON ab.id = aa.album_id
        INNER JOIN artists at ON aa.artist_id = at.id
        WHERE ab.id = :album_id
          AND ab.is_active = TRUE
          AND at.is_active = TRUE
        ORDER BY at.name
    """)
    result = db.execute(query, {"album_id": album_id})
    rows = result.fetchall()

    if not rows:
        raise HTTPException(status_code=404, detail="Album not found")

    # Get album basic info from first row
    first_row = rows[0]
    album_id = first_row[0]
    album_name = first_row[1]
    cover_image_url = first_row[2]
    release_date = first_row[3]

    # Aggregate all artists for this album
    artist_names = []
    artist_ids = []
    
    for row in rows:
        artist_names.append(row[4])  # artist name
        artist_ids.append(row[5])    # artist id

    return AlbumResponse(
        id=album_id,
        name=album_name,
        cover_image_url=cover_image_url,
        release_date=release_date,
        artist_name=", ".join(artist_names),
        artist_id=", ".join(artist_ids)
    )

@router.get("/album/{album_id}/songs", response_model=List[TrackResponse])
def get_album_songs(album_id: str, db: Session = Depends(get_db)):
    query = text("""
        SELECT s.track_id, s.track_name, at.id AS artist_id, at.name AS artist_name, 
               ab.id AS album_id, ab.name AS album_name,
               s.duration_ms, s.track_image_url
        FROM songs s
        INNER JOIN albums ab ON ab.id = s.album_id
        INNER JOIN artists at ON at.id = s.artist_id
        WHERE ab.id = :album_id
          AND s.is_active = TRUE
          AND ab.is_active = TRUE
          AND at.is_active = TRUE
        ORDER BY s.track_id, at.name
    """)
    result = db.execute(query, {"album_id": album_id})
    rows = result.fetchall()

    if not rows:
        raise HTTPException(status_code=404, detail="No songs found in this album")

    # Aggregate artists by track (same logic as your playlist endpoint)
    track_map = defaultdict(lambda: {
        "id": None,
        "title": None,
        "artist_id": set(),
        "artists": set(),
        "album_id": None,
        "album": None,
        "duration": None,
        "cover_url": None,
        "date_added": None,
    })

    for row in rows:
        track_id = row[0]
        track = track_map[track_id]
        track["id"] = track_id
        track["title"] = row[1]
        track["artist_id"].add(row[2])
        track["artists"].add(row[3])
        track["album_id"] = row[4]
        track["album"] = row[5]
        track["duration"] = format_duration(row[6])
        track["cover_url"] = row[7]
        track["date_added"] = None

    return [
        TrackResponse(
            id=track["id"],
            title=track["title"],
            artist_id=", ".join(sorted(track["artist_id"])),
            artist=", ".join(sorted(track["artists"])),
            album_id=track["album_id"],
            album=track["album"],
            duration=track["duration"],
            cover_url=track["cover_url"],
            date_added=track["date_added"].isoformat() if track["date_added"] else None
        )
        for track in track_map.values()
    ]

@router.post("/user/add_track_to_playlist")
def add_track_to_playlist(
    track_id: str = Body(...),
    playlist_id: str = Body(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    user_id = current_user.id
    track_exists = db.execute(text("""
        SELECT 1
        FROM songs s
        JOIN artists at ON at.id = s.artist_id
        JOIN albums ab ON ab.id = s.album_id
        WHERE s.track_id = :track_id
          AND s.is_active = TRUE
          AND at.is_active = TRUE
          AND ab.is_active = TRUE
        LIMIT 1
    """), {"track_id": track_id}).fetchone()

    if not track_exists:
        raise HTTPException(status_code=404, detail="Track is unavailable")

    # Step 1: Check if track already exists
    existing = db.execute(text("""
        SELECT 1 FROM playlist_tracks
        WHERE playlist_id = :playlist_id AND track_id = :track_id
    """), {"playlist_id": playlist_id, "track_id": track_id}).fetchone()

    if existing:
        raise HTTPException(status_code=409, detail="Track already exists in playlist")

    # Step 2: Insert the track
    local_time = datetime.now(ZoneInfo("Asia/Bangkok"))
    naive_time = local_time.replace(tzinfo=None)
    db.execute(text("""
        INSERT INTO playlist_tracks (playlist_id, track_id, date_added)
        VALUES (:playlist_id, :track_id, :date_added)
    """), {
        "playlist_id": playlist_id,
        "track_id": track_id,
        "date_added": naive_time
    })

    db.commit()
    return {"message": "Track successfully added to playlist"}

@router.post("/add_to_library/{item_id}")
def add_to_library(
    item_id: str,
    type: str = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    user_id = current_user.id
    new_entry = PlaylistUser(
        playlist_id=item_id,
        user_id=user_id,
        type=type
    )

    db.add(new_entry)
    db.commit()

@router.delete("/remove_from_library/{item_id}")
def remove_from_library(
    item_id:str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    user_id = current_user.id
    delete_query = text("""
        DELETE FROM playlist_user
        WHERE playlist_id = :item_id AND user_id = :user_id
    """)
    result = db.execute(delete_query, {
        "item_id": item_id,
        "user_id": user_id
    })
    db.commit()

    if result.rowcount == 0:
        raise HTTPException(status_code=404, detail="Playlist not found in library")

    return {"message": "Playlist removed from library"}

### Artist API
@router.get("/artist/{artist_id}", response_model=ArtistResponse)
def get_artist_by_id(artist_id: str, db: Session = Depends(get_db)):
    query = text("SELECT id, name, image_url FROM artists WHERE id = :artist_id AND is_active = TRUE")
    result = db.execute(query, {"artist_id": artist_id}).fetchone()

    if not result:
        raise HTTPException(status_code=404, detail="Artist not found")

    return ArtistResponse(
        id=result[0],
        name=result[1],
        profile_image_url=result[2],
    )

@router.get("/artist/{artist_id}/songs", response_model=List[TrackResponse])
def get_artist_songs(artist_id: str, db: Session = Depends(get_db)):
    query = text("""
        SELECT s.track_id, s.track_name, at.id AS artist_id, at.name AS artist_name, 
               ab.id AS album_id, ab.name AS album_name,
               s.duration_ms, s.track_image_url
        FROM songs s
        INNER JOIN artists at ON at.id = s.artist_id
        INNER JOIN albums ab ON ab.id = s.album_id
        WHERE s.track_id IN (
            SELECT DISTINCT s2.track_id 
            FROM songs s2 
            WHERE s2.artist_id = :artist_id
              AND s2.is_active = TRUE
        )
          AND s.is_active = TRUE
          AND at.is_active = TRUE
          AND ab.is_active = TRUE
        ORDER BY s.track_id, at.name
    """)
    result = db.execute(query, {"artist_id": artist_id})
    rows = result.fetchall()

    if not rows:
        raise HTTPException(status_code=404, detail="No songs found for this artist")

    # Aggregate artists by track (same logic as album/playlist endpoints)
    track_map = defaultdict(lambda: {
        "id": None,
        "title": None,
        "artist_id": set(),
        "artists": set(),
        "album_id": None,
        "album": None,
        "duration": None,
        "cover_url": None,
        "date_added": None,
    })

    for row in rows:
        track_id = row[0]
        track = track_map[track_id]
        track["id"] = track_id
        track["title"] = row[1]
        track["artist_id"].add(row[2])
        track["artists"].add(row[3])
        track["album_id"] = row[4]
        track["album"] = row[5]
        track["duration"] = format_duration(row[6])
        track["cover_url"] = row[7]
        track["date_added"] = None

    return [
        TrackResponse(
            id=track["id"],
            title=track["title"],
            artist_id=", ".join(sorted(track["artist_id"])),
            artist=", ".join(sorted(track["artists"])),
            album_id=track["album_id"],
            album=track["album"],
            duration=track["duration"],
            cover_url=track["cover_url"],
            date_added=track["date_added"].isoformat() if track["date_added"] else None
        )
        for track in track_map.values()
    ]

### Search API
@router.get("/search", response_model=Union[List[TrackResponse], List[AlbumResponse], List[ArtistResponse]])
def search_items(
    query: str = Query(..., alias="query", description="Search keyword"),  # <-- use alias
    filter_by: str = Query("track", description="Search filter: track, album, or artist"),
    db: Session = Depends(get_db)
):
    keyword_like = f"%{query.lower()}%"

    if filter_by == "track":
        query = text("""
            WITH filtered_songs AS (
                SELECT * FROM songs 
                WHERE LOWER(track_name) LIKE :keyword
                  AND is_active = TRUE
                LIMIT 50
            )
            SELECT fs.track_id, fs.track_name, a.id AS artist_id, a.name AS artist_name, al.id AS album_id, al.name AS album_name,
                fs.duration_ms, fs.track_image_url
            FROM filtered_songs fs
            JOIN artists a ON fs.artist_id = a.id
            JOIN albums al ON fs.album_id = al.id
            WHERE a.is_active = TRUE AND al.is_active = TRUE
        """)
        rows = db.execute(query, {"keyword": keyword_like}).fetchall()

        if not rows:
            raise HTTPException(status_code=404, detail="No songs found in this playlist")

        # Aggregate artists by track
        track_map = defaultdict(lambda: {
            "id": None,
            "title": None,
            "artist_id": set(),
            "artists": set(),
            "album_id": None,
            "album": None,
            "duration": None,
            "cover_url": None,
            "date_added": None,
        })

        for row in rows:
            track_id = row[0]
            track = track_map[track_id]
            track["id"] = track_id
            track["title"] = row[1]
            track["artist_id"].add(row[2])
            track["artists"].add(row[3])
            track["album_id"] = row[4]
            track["album"] = row[5]
            track["duration"] = format_duration(row[6])
            track["cover_url"] = row[7]
            track["date_added"] = None

        return [
            TrackResponse(
                id=track["id"],
                title=track["title"],
                artist_id=", ".join(sorted(track["artist_id"])),
                artist=", ".join(sorted(track["artists"])),
                album_id=track["album_id"],
                album=track["album"],
                duration=track["duration"],
                cover_url=track["cover_url"],
                date_added=track["date_added"].isoformat() if track["date_added"] else None
            )
            for track in track_map.values()
        ]

    elif filter_by == "album":
        query = text("""
            SELECT ab.id AS album_id, ab.name, ab.image_url, ab.release_date,
                   at.id AS artist_id, at.name AS artist_name
            FROM albums ab
            JOIN album_artists aa ON ab.id = aa.album_id
            JOIN artists at ON aa.artist_id = at.id
            WHERE LOWER(ab.name) LIKE :keyword
              AND ab.is_active = TRUE
              AND at.is_active = TRUE
        """)
        rows = db.execute(query, {"keyword": keyword_like}).fetchall()

        album_map = defaultdict(lambda: {
            "id": None,
            "name": None,
            "cover_image_url": None,
            "release_date": None,
            "artist_ids": set(),
            "artist_names": set()
        })

        for row in rows:
            album_id = row[0]
            album = album_map[album_id]
            album["id"] = album_id
            album["name"] = row[1]
            album["cover_image_url"] = row[2]
            album["release_date"] = row[3]
            album["artist_ids"].add(row[4])
            album["artist_names"].add(row[5])

        return [
            AlbumResponse(
                id=album["id"],
                name=album["name"],
                cover_image_url=album["cover_image_url"],
                release_date=album["release_date"],
                artist_id=", ".join(album["artist_ids"]),
                artist_name=", ".join(sorted(album["artist_names"]))
            )
            for album in album_map.values()
        ]

    elif filter_by == "artist":
        query = text("""
            SELECT id, name, image_url
            FROM artists
            WHERE LOWER(name) LIKE :keyword
              AND is_active = TRUE
        """)
        rows = db.execute(query, {"keyword": keyword_like}).fetchall()

        return [
            ArtistResponse(
                id=row[0],
                name=row[1],
                profile_image_url=row[2],
            )
            for row in rows
        ]

    return []

@router.get("/mp3url/{track_name}")
def get_mp3_url(track_name: str):
    try:
        url = generate_presigned_url(track_name)
        if not url:
            return JSONResponse(status_code=404, content={"detail": "URL could not be generated"})
        return {"url": url}
    except Exception as e:
        return JSONResponse(status_code=500, content={"detail": str(e)})

@router.get("/user/liked_track", response_model=List[TrackResponse])
def get_liked_tracks(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    user_id = current_user.id
    query = text("""
        SELECT s.track_id, s.track_name, at.id AS artist_id, at.name AS artist_name, ab.id AS album_id, ab.name AS album_name,
               s.duration_ms, s.track_image_url, pt.date_added
        FROM songs s
        INNER JOIN playlist_tracks pt ON s.track_id = pt.track_id
        INNER JOIN playlist_user pu ON pu.playlist_id = pt.playlist_id
        INNER JOIN playlists p ON p.id = pt.playlist_id
        INNER JOIN artists at ON at.id = s.artist_id
        INNER JOIN albums ab ON ab.id = s.album_id
        WHERE pu.user_id = :user_id AND p.name = 'Liked Songs'
          AND s.is_active = TRUE
          AND at.is_active = TRUE
          AND ab.is_active = TRUE
    """)
    result = db.execute(query, {"user_id": user_id})
    rows = result.fetchall()

    # Aggregate artists by track
    track_map = defaultdict(lambda: {
        "id": None,
        "title": None,
        "artist_id": set(),
        "artists": set(),
        "album_id": None,
        "album": None,
        "duration": None,
        "cover_url": None,
        "date_added": None,
    })

    for row in rows:
        track_id = row[0]
        track = track_map[track_id]
        track["id"] = track_id
        track["title"] = row[1]
        track["artist_id"].add(row[2])
        track["artists"].add(row[3])
        track["album_id"] = row[4]
        track["album"] = row[5]
        track["duration"] = format_duration(row[6])
        track["cover_url"] = row[7]
        track["date_added"] = row[8]

    return [
        TrackResponse(
            id=track["id"],
            title=track["title"],
            artist_id=", ".join(sorted(track["artist_id"])),
            artist=", ".join(sorted(track["artists"])),
            album_id=track["album_id"],
            album=track["album"],
            duration=track["duration"],
            cover_url=track["cover_url"],
            date_added=track["date_added"].isoformat() if track["date_added"] else None
        )
        for track in track_map.values()
    ]

@router.get("/user/liked_track_ids", response_model=List[str])
def get_liked_track_ids(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    user_id = current_user.id
    query = text("""
        SELECT pt.track_id
        FROM playlist_tracks pt
        INNER JOIN songs s ON s.track_id = pt.track_id
        INNER JOIN artists at ON at.id = s.artist_id
        INNER JOIN albums ab ON ab.id = s.album_id
        INNER JOIN playlist_user pu ON pu.playlist_id = pt.playlist_id
        INNER JOIN playlists p ON p.id = pt.playlist_id
        WHERE pu.user_id = :user_id AND p.name = 'Liked Songs'
          AND s.is_active = TRUE
          AND at.is_active = TRUE
          AND ab.is_active = TRUE
    """)
    result = db.execute(query, {"user_id": user_id}).fetchall()
    return [row[0] for row in result]


@router.post("/user/liked_track")
def add_to_liked_playlist(
    track_id: str = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    user_id = current_user.id
    local_time = datetime.now(ZoneInfo("Asia/Bangkok"))
    naive_time = local_time.replace(tzinfo=None)
    track_exists = db.execute(text("""
        SELECT 1
        FROM songs s
        JOIN artists at ON at.id = s.artist_id
        JOIN albums ab ON ab.id = s.album_id
        WHERE s.track_id = :track_id
          AND s.is_active = TRUE
          AND at.is_active = TRUE
          AND ab.is_active = TRUE
        LIMIT 1
    """), {"track_id": track_id}).fetchone()
    if not track_exists:
        raise HTTPException(status_code=404, detail="Track is unavailable")

    # Get Liked Songs playlist ID (p.name = 'Liked Songs' is error)
    playlist_query = text("""
        SELECT p.id FROM playlists p
        INNER JOIN playlist_user pu ON pu.playlist_id = p.id
        WHERE pu.user_id = :user_id AND p.name = 'Liked Songs' 
        LIMIT 1
    """)
    result = db.execute(playlist_query, {"user_id": user_id}).first()
    
    # Auto-create Liked Songs playlist if it doesn't exist
    if not result:
        # Create the playlist using ORM (not raw SQL to avoid schema issues)
        liked_playlist = Playlist(
            name="Liked Songs",
            description="Your personal liked songs collection",
            cover_image_url="https://misc.scdn.co/liked-songs/liked-songs-640.png",
        )
        db.add(liked_playlist)
        db.commit()
        db.refresh(liked_playlist)
        
        playlist_id = liked_playlist.id
        
        # Link playlist to user
        playlist_user = PlaylistUser(
            playlist_id=playlist_id,
            user_id=user_id,
            type="playlist",
        )
        db.add(playlist_user)
        db.commit()
    else:
        playlist_id = result[0]

    # Check if track is already added
    exists_query = text("""
        SELECT 1 FROM playlist_tracks
        WHERE playlist_id = :playlist_id AND track_id = :track_id
        LIMIT 1
    """)
    exists = db.execute(exists_query, {"playlist_id": playlist_id, "track_id": track_id}).first()
    if exists:
        raise HTTPException(status_code=409, detail="Track already in Liked Songs")

    # Insert the track
    insert_query = text("""
        INSERT INTO playlist_tracks (playlist_id, track_id, date_added)
        VALUES (:playlist_id, :track_id, :date_added)
    """)
    db.execute(insert_query, {
        "playlist_id": playlist_id,
        "track_id": track_id,
        "date_added": naive_time
    })
    db.commit()

    return {"message": "Track added to Liked Songs"}

@router.delete("/user/liked_track")
def remove_from_liked_playlist(
    track_id: str = Query(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    user_id = current_user.id
    try:
        # Find Liked Songs playlist ID
        playlist_query = text("""
            SELECT pu.playlist_id
            FROM playlist_user pu
            JOIN playlists p ON pu.playlist_id = p.id
            WHERE pu.user_id = :user_id AND p.name = 'Liked Songs'
        """)
        result = db.execute(playlist_query, {"user_id": user_id}).fetchone()

        if not result:
            raise HTTPException(status_code=404, detail="Liked Songs playlist not found.")

        playlist_id = result[0]

        # Remove the track from the playlist
        delete_query = text("""
            DELETE FROM playlist_tracks
            WHERE playlist_id = :playlist_id AND track_id = :track_id
        """)
        db.execute(delete_query, {"playlist_id": playlist_id, "track_id": track_id})
        db.commit()

        return {"message": "Track removed from liked songs."}
    
    except Exception as e:
        db.rollback()
        raise HTTPException(status_code=500, detail=str(e))

# @router.get("/related")  
# def get_recommendations(track_id: str = Query(...)):
#     idx = recommender.data_df[recommender.data_df["track_id"] == track_id].index[0]
#     query_vector = recommender.track_features[idx].reshape(1, -1)

#     distances, indices = recommender.faiss_index.search(query_vector, 6)
#     similar = recommender.data_df.iloc[indices[0][1:]]
#     return similar[['track_id', 'track_name', 'artists', 'track_genre', 'popularity']].to_dict(orient="records")

@router.get("/related/{track_id}", response_model=List[TrackResponse])
def get_related_songs(track_id: str, db: Session = Depends(get_db)):
    rows = []
    
    # Try to get related tracks from recommender
    try:
        similar_ids = recommender.get_related_tracks(track_id)
        if similar_ids:
            track_ids = random.sample(similar_ids, min(3, len(similar_ids)))
            for tid in track_ids:
                query = text("""
                    SELECT s.track_id, s.track_name, at.id AS artist_id, at.name AS artist_name,
                           ab.id AS album_id, ab.name AS album_name,
                           s.duration_ms, s.track_image_url
                    FROM songs s
                    JOIN artists at ON at.id = s.artist_id
                    JOIN albums ab ON ab.id = s.album_id
                    WHERE s.track_id = :track_id
                      AND s.is_active = TRUE
                      AND at.is_active = TRUE
                      AND ab.is_active = TRUE
                """)
                row = db.execute(query, {"track_id": tid}).fetchone()
                if row:
                    rows.append(row)
    except Exception as e:
        print(f"Related tracks error: {e}")

    # Fallback: If no related tracks found, get random tracks from the database
    if not rows:
        query = text("""
            SELECT s.track_id, s.track_name, at.id AS artist_id, at.name AS artist_name,
                   ab.id AS album_id, ab.name AS album_name,
                   s.duration_ms, s.track_image_url
            FROM songs s
            JOIN artists at ON at.id = s.artist_id
            JOIN albums ab ON ab.id = s.album_id
            WHERE s.track_id != :current_track_id
              AND s.is_active = TRUE
              AND at.is_active = TRUE
              AND ab.is_active = TRUE
            ORDER BY RANDOM()
            LIMIT 3
        """)
        rows = db.execute(query, {"current_track_id": track_id}).fetchall()

    if not rows:
        return []

    track_map = defaultdict(lambda: {
        "id": None,
        "title": None,
        "artist_id": set(),
        "artists": set(),
        "album_id": None,
        "album": None,
        "duration": None,
        "cover_url": None,
        "date_added": None,
    })

    for row in rows:
        tid = row[0]
        track = track_map[tid]
        track["id"] = tid
        track["title"] = row[1]
        track["artist_id"].add(row[2])
        track["artists"].add(row[3])
        track["album_id"] = row[4]
        track["album"] = row[5]
        track["duration"] = format_duration(row[6])
        track["cover_url"] = row[7]

    return [
        TrackResponse(
            id=track["id"],
            title=track["title"],
            artist_id=", ".join(sorted(track["artist_id"])),
            artist=", ".join(sorted(track["artists"])),
            album_id=track["album_id"],
            album=track["album"],
            duration=track["duration"],
            cover_url=track["cover_url"],
            date_added=None 
        )
        for track in track_map.values()
    ]


@router.get("/featured", response_model=List[TrackResponse])
def get_featured_songs(db: Session = Depends(get_db)):
    rows = db.execute(text("""
        SELECT s.track_id, s.track_name, at.id AS artist_id, at.name AS artist_name,
               ab.id AS album_id, ab.name AS album_name,
               s.duration_ms, s.track_image_url
        FROM songs s
        JOIN artists at ON at.id = s.artist_id
        JOIN albums ab ON ab.id = s.album_id
        WHERE s.is_active = TRUE
          AND at.is_active = TRUE
          AND ab.is_active = TRUE
        ORDER BY RANDOM()
        LIMIT 15
    """)).fetchall()

    track_map = defaultdict(lambda: {
        "id": None,
        "title": None,
        "artist_id": set(),
        "artists": set(),
        "album_id": None,
        "album": None,
        "duration": None,
        "cover_url": None,
        "date_added": None,
    })

    for row in rows:
        track_id = row[0]
        track = track_map[track_id]
        track["id"] = track_id
        track["title"] = row[1]
        track["artist_id"].add(row[2])
        track["artists"].add(row[3])
        track["album_id"] = row[4]
        track["album"] = row[5]
        track["duration"] = format_duration(row[6])
        track["cover_url"] = row[7]

    return [
        TrackResponse(
            id=track["id"],
            title=track["title"],
            artist_id=", ".join(sorted(track["artist_id"])),
            artist=", ".join(sorted(track["artists"])),
            album_id=track["album_id"],
            album=track["album"],
            duration=track["duration"],
            cover_url=track["cover_url"],
            date_added=None
        )
        for track in track_map.values()
    ]


@router.get("/home-sections")
def get_home_sections(db: Session = Depends(get_db)):
    popular_artist_rows = db.execute(text("""
        SELECT at.id, at.name, at.image_url, AVG(COALESCE(s.popularity, 0)) AS score
        FROM artists at
        JOIN songs s ON s.artist_id = at.id
        JOIN albums ab ON ab.id = s.album_id
        WHERE at.is_active = TRUE
          AND s.is_active = TRUE
          AND ab.is_active = TRUE
        GROUP BY at.id, at.name, at.image_url
        ORDER BY score DESC, COUNT(DISTINCT s.track_id) DESC
        LIMIT 12
    """)).fetchall()

    popular_album_rows = db.execute(text("""
        SELECT ab.id, ab.name, ab.image_url, ab.release_date,
               STRING_AGG(DISTINCT at.id, ', ') AS artist_id,
               STRING_AGG(DISTINCT at.name, ', ') AS artist_name,
               MAX(COALESCE(s.popularity, 0)) AS score
        FROM albums ab
        JOIN songs s ON s.album_id = ab.id
        JOIN artists at ON at.id = s.artist_id
        WHERE ab.is_active = TRUE
          AND s.is_active = TRUE
          AND at.is_active = TRUE
        GROUP BY ab.id, ab.name, ab.image_url, ab.release_date
        ORDER BY score DESC, ab.release_date DESC NULLS LAST
        LIMIT 12
    """)).fetchall()

    radio_rows = db.execute(text("""
        SELECT s.track_genre, MAX(s.track_image_url) AS image_url,
               COUNT(DISTINCT s.track_id) AS track_count,
               AVG(COALESCE(s.popularity, 0)) AS score
        FROM songs s
        JOIN artists at ON at.id = s.artist_id
        JOIN albums ab ON ab.id = s.album_id
        WHERE s.is_active = TRUE
          AND at.is_active = TRUE
          AND ab.is_active = TRUE
          AND s.track_genre IS NOT NULL
        GROUP BY s.track_genre
        ORDER BY score DESC, track_count DESC
        LIMIT 12
    """)).fetchall()

    global_chart_rows = db.execute(text("""
        SELECT s.track_id, s.track_name, at.name AS artist_name, s.track_image_url,
               COALESCE(s.popularity, 0) AS popularity
        FROM songs s
        JOIN artists at ON at.id = s.artist_id
        JOIN albums ab ON ab.id = s.album_id
        WHERE s.is_active = TRUE
          AND at.is_active = TRUE
          AND ab.is_active = TRUE
        ORDER BY popularity DESC
        LIMIT 12
    """)).fetchall()

    vietnam_chart_rows = db.execute(text("""
        SELECT s.track_id, s.track_name, at.name AS artist_name, s.track_image_url,
               COALESCE(s.popularity, 0) AS popularity
        FROM songs s
        JOIN artists at ON at.id = s.artist_id
        JOIN albums ab ON ab.id = s.album_id
        WHERE s.is_active = TRUE
          AND at.is_active = TRUE
          AND ab.is_active = TRUE
          AND (
            LOWER(at.name) LIKE '%son tung%'
            OR LOWER(at.name) LIKE '%mtp%'
            OR LOWER(at.name) LIKE '%den vau%'
            OR LOWER(at.name) LIKE '%hoang thuy linh%'
            OR LOWER(at.name) LIKE '%binz%'
            OR LOWER(at.name) LIKE '%amee%'
            OR LOWER(at.name) LIKE '%mono%'
            OR LOWER(at.name) LIKE '%erik%'
            OR LOWER(at.name) LIKE '%min%'
            OR LOWER(at.name) LIKE '%duc phuc%'
            OR LOWER(at.name) LIKE '%justatee%'
            OR LOWER(s.track_name) LIKE '%vietnam%'
            OR LOWER(s.track_name) LIKE '%viet nam%'
          )
        ORDER BY popularity DESC
        LIMIT 12
    """)).fetchall()

    if not vietnam_chart_rows:
        vietnam_chart_rows = db.execute(text("""
            SELECT s.track_id, s.track_name, at.name AS artist_name, s.track_image_url,
                   COALESCE(s.popularity, 0) AS popularity
            FROM songs s
            JOIN artists at ON at.id = s.artist_id
            JOIN albums ab ON ab.id = s.album_id
            WHERE s.is_active = TRUE
              AND at.is_active = TRUE
              AND ab.is_active = TRUE
            ORDER BY popularity DESC
            OFFSET 12
            LIMIT 12
        """)).fetchall()

    top_global = global_chart_rows[0] if global_chart_rows else None
    top_vietnam = vietnam_chart_rows[0] if vietnam_chart_rows else None

    return {
        "popular_artists": [
            {
                "id": row[0],
                "title": row[1],
                "subtitle": "Artist",
                "image": row[2],
                "type": "artist",
            }
            for row in popular_artist_rows
        ],
        "popular_albums": [
            {
                "id": row[0],
                "title": row[1],
                "subtitle": row[5] or "Album",
                "image": row[2],
                "type": "album",
            }
            for row in popular_album_rows
        ],
        "popular_radio": [
            {
                "id": f"radio-{row[0]}",
                "title": f"{str(row[0]).replace('-', ' ').title()} Radio",
                "subtitle": "Popular tracks and artists",
                "image": row[1],
                "type": "radio",
            }
            for row in radio_rows
        ],
        "featured_charts": [
            {
                "id": "top-songs-global",
                "title": "Top Songs - Global",
                "subtitle": "The most popular tracks right now",
                "image": None,
                "type": "chart",
            },
            {
                "id": "top-songs-vietnam",
                "title": "Top Songs - Vietnam",
                "subtitle": "Vietnam picks from the catalog",
                "image": None,
                "type": "chart",
            },
        ],
        "top_songs_global": [
            {
                "id": row[0],
                "title": row[1],
                "subtitle": row[2],
                "artist": row[2],
                "image": row[3],
                "cover_url": row[3],
                "type": "track",
            }
            for row in global_chart_rows
        ],
        "top_songs_vietnam": [
            {
                "id": row[0],
                "title": row[1],
                "subtitle": row[2],
                "artist": row[2],
                "image": row[3],
                "cover_url": row[3],
                "type": "track",
            }
            for row in vietnam_chart_rows
        ],
    }


@router.get("/charts/{chart_id}")
def get_chart(chart_id: str, db: Session = Depends(get_db)):
    chart_map = {
        "top-songs-global": {
            "title": "Top Songs - Global",
            "description": "The most popular tracks right now.",
        },
        "top-songs-vietnam": {
            "title": "Top Songs - Vietnam",
            "description": "Vietnam picks from the catalog.",
        },
    }
    if chart_id not in chart_map:
        raise HTTPException(status_code=404, detail="Chart not found")

    if chart_id == "top-songs-vietnam":
        rows = db.execute(text("""
            SELECT s.track_id, s.track_name, at.id AS artist_id, at.name AS artist_name,
                   ab.id AS album_id, ab.name AS album_name,
                   s.duration_ms, s.track_image_url, COALESCE(s.popularity, 0) AS popularity
            FROM songs s
            JOIN artists at ON at.id = s.artist_id
            JOIN albums ab ON ab.id = s.album_id
            WHERE s.is_active = TRUE
              AND at.is_active = TRUE
              AND ab.is_active = TRUE
              AND (
                LOWER(at.name) LIKE '%son tung%'
                OR LOWER(at.name) LIKE '%mtp%'
                OR LOWER(at.name) LIKE '%den vau%'
                OR LOWER(at.name) LIKE '%hoang thuy linh%'
                OR LOWER(at.name) LIKE '%binz%'
                OR LOWER(at.name) LIKE '%amee%'
                OR LOWER(at.name) LIKE '%mono%'
                OR LOWER(at.name) LIKE '%erik%'
                OR LOWER(at.name) LIKE '%min%'
                OR LOWER(at.name) LIKE '%duc phuc%'
                OR LOWER(at.name) LIKE '%justatee%'
                OR LOWER(s.track_name) LIKE '%vietnam%'
                OR LOWER(s.track_name) LIKE '%viet nam%'
              )
            ORDER BY popularity DESC
            LIMIT 50
        """)).fetchall()

        if not rows:
            rows = db.execute(text("""
                SELECT s.track_id, s.track_name, at.id AS artist_id, at.name AS artist_name,
                       ab.id AS album_id, ab.name AS album_name,
                       s.duration_ms, s.track_image_url, COALESCE(s.popularity, 0) AS popularity
                FROM songs s
                JOIN artists at ON at.id = s.artist_id
                JOIN albums ab ON ab.id = s.album_id
                WHERE s.is_active = TRUE
                  AND at.is_active = TRUE
                  AND ab.is_active = TRUE
                ORDER BY popularity DESC
                OFFSET 12
                LIMIT 50
            """)).fetchall()
    else:
        rows = db.execute(text("""
            SELECT s.track_id, s.track_name, at.id AS artist_id, at.name AS artist_name,
                   ab.id AS album_id, ab.name AS album_name,
                   s.duration_ms, s.track_image_url, COALESCE(s.popularity, 0) AS popularity
            FROM songs s
            JOIN artists at ON at.id = s.artist_id
            JOIN albums ab ON ab.id = s.album_id
            WHERE s.is_active = TRUE
              AND at.is_active = TRUE
              AND ab.is_active = TRUE
            ORDER BY popularity DESC
            LIMIT 50
        """)).fetchall()

    tracks = [
        {
            "id": row[0],
            "title": row[1],
            "artist_id": row[2],
            "artist": row[3],
            "album_id": row[4],
            "album": row[5],
            "duration": format_duration(row[6]),
            "cover_url": row[7],
            "date_added": None,
        }
        for row in rows
    ]

    return {
        "id": chart_id,
        "title": chart_map[chart_id]["title"],
        "description": chart_map[chart_id]["description"],
        "cover_url": tracks[0]["cover_url"] if tracks else None,
        "tracks": tracks,
    }


@router.get("/recommendations", response_model=List[TrackResponse])
def get_recommendations(current_user: User = Depends(get_current_user), db: Session = Depends(get_db)):
    user_id = current_user.id
    rows = []
    
    # Try to get recommendations from BigQuery first
    try:
        recommended_track_ids = recommender.get_recommendations(user_id)
        if recommended_track_ids:
            for tid in recommended_track_ids:
                query = text("""
                    SELECT s.track_id, s.track_name, at.id AS artist_id, at.name AS artist_name,
                           ab.id AS album_id, ab.name AS album_name,
                           s.duration_ms, s.track_image_url
                    FROM songs s
                    JOIN artists at ON at.id = s.artist_id
                    JOIN albums ab ON ab.id = s.album_id
                    WHERE s.track_id = :track_id
                      AND s.is_active = TRUE
                      AND at.is_active = TRUE
                      AND ab.is_active = TRUE
                """)
                row = db.execute(query, {"track_id": tid}).fetchone()
                if row:
                    rows.append(row)
    except Exception as e:
        print(f"Recommendation error: {e}")
    
    # Fallback: If no recommendations found, get random tracks from the database
    if not rows:
        query = text("""
            SELECT s.track_id, s.track_name, at.id AS artist_id, at.name AS artist_name,
                   ab.id AS album_id, ab.name AS album_name,
                   s.duration_ms, s.track_image_url
            FROM songs s
            JOIN artists at ON at.id = s.artist_id
            JOIN albums ab ON ab.id = s.album_id
            WHERE s.is_active = TRUE
              AND at.is_active = TRUE
              AND ab.is_active = TRUE
            ORDER BY RANDOM()
            LIMIT 15
        """)
        rows = db.execute(query).fetchall()

    if not rows:
        return []

    track_map = defaultdict(lambda: {
        "id": None,
        "title": None,
        "artist_id": set(),
        "artists": set(),
        "album_id": None,
        "album": None,
        "duration": None,
        "cover_url": None,
        "date_added": None,
    })

    for row in rows:
        track_id = row[0]
        track = track_map[track_id]
        track["id"] = track_id
        track["title"] = row[1]
        track["artist_id"].add(row[2])
        track["artists"].add(row[3])
        track["album_id"] = row[4]
        track["album"] = row[5]
        track["duration"] = format_duration(row[6])
        track["cover_url"] = row[7]

    return [
        TrackResponse(
            id=track["id"],
            title=track["title"],
            artist_id=", ".join(sorted(track["artist_id"])),
            artist=", ".join(sorted(track["artists"])),
            album_id=track["album_id"],
            album=track["album"],
            duration=track["duration"],
            cover_url=track["cover_url"],
            date_added=None 
        )
        for track in track_map.values()
    ]

@router.get("/recommendations/emotion/{emo}", response_model=List[TrackResponse])
def get_emo_recommendations(
    emo: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    subscription = ensure_user_has_subscription(db, current_user)
    plan = get_subscription_plan(db, subscription)
    if not plan.emotion_recommendations:
        raise HTTPException(status_code=403, detail="Emotion recommendations are available for Premium users only.")

    recommended_track_ids = recommender.get_emo_recommendations(current_user.id, emo)
    if not recommended_track_ids:
        return []

    rows = []
    for tid in recommended_track_ids:
        query = text("""
            SELECT s.track_id, s.track_name, at.id AS artist_id, at.name AS artist_name,
                   ab.id AS album_id, ab.name AS album_name,
                   s.duration_ms, s.track_image_url
            FROM songs s
            JOIN artists at ON at.id = s.artist_id
            JOIN albums ab ON ab.id = s.album_id
            WHERE s.track_id = :track_id
              AND s.is_active = TRUE
              AND at.is_active = TRUE
              AND ab.is_active = TRUE
        """)
        row = db.execute(query, {"track_id": tid}).fetchone()
        if row:
            rows.append(row)

    track_map = defaultdict(lambda: {
        "id": None,
        "title": None,
        "artist_id": set(),
        "artists": set(),
        "album_id": None,
        "album": None,
        "duration": None,
        "cover_url": None,
        "date_added": None,
    })

    for row in rows:
        track_id = row[0]
        track = track_map[track_id]
        track["id"] = track_id
        track["title"] = row[1]
        track["artist_id"].add(row[2])
        track["artists"].add(row[3])
        track["album_id"] = row[4]
        track["album"] = row[5]
        track["duration"] = format_duration(row[6])
        track["cover_url"] = row[7]

    return [
        TrackResponse(
            id=track["id"],
            title=track["title"],
            artist_id=", ".join(sorted(track["artist_id"])),
            artist=", ".join(sorted(track["artists"])),
            album_id=track["album_id"],
            album=track["album"],
            duration=track["duration"],
            cover_url=track["cover_url"],
            date_added=None 
        )
        for track in track_map.values()
    ]

### Library API
@router.put("/library/{item_id}/last_played")
def update_last_played(
    item_id: str,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    entry = db.query(PlaylistUser).filter(
        PlaylistUser.user_id == current_user.id,
        PlaylistUser.playlist_id == item_id
    ).first()

    if not entry:
        raise HTTPException(status_code=403, detail="Item is not in user's library")

    asia_time = datetime.now(ASIA_TIMEZONE)
    entry.last_played = asia_time.replace(tzinfo=None)
    
    db.commit()
    return {"message": f"Updated last_played for item {item_id}"}


API_KEY = os.getenv("GEMINI_API_KEY")
import google.generativeai as genai

if API_KEY:
    genai.configure(api_key=API_KEY)


def build_local_emotion_reply(user_prompt: str) -> dict:
    text = user_prompt.lower()
    mood_rules = [
        ("Angry", ["angry", "mad", "furious", "annoyed", "buc", "tuc", "cay", "gian"]),
        ("Sad", ["sad", "down", "cry", "heartbroken", "buon", "khoc", "met moi", "chan"]),
        ("Lonely", ["lonely", "alone", "empty", "co don", "mot minh", "trong rong"]),
        ("Happy", ["happy", "great", "excited", "vui", "hanh phuc", "yeu doi"]),
        ("Chill", ["calm", "relax", "chill", "peaceful", "binh yen", "thu gian"]),
    ]

    mood = "Chill"
    for candidate, keywords in mood_rules:
        if any(keyword in text for keyword in keywords):
            mood = candidate
            break

    intros = {
        "Angry": "It sounds like there is a lot of tension in you right now. Take a moment to breathe, and maybe these songs can help release some of that energy.",
        "Sad": "I am sorry you are feeling this way. Let yourself slow down for a while, and maybe these songs can sit with you gently.",
        "Lonely": "Feeling alone can be heavy, even when it is hard to explain. Maybe these songs can make the moment feel a little less quiet.",
        "Happy": "That sounds like a bright moment worth enjoying. Maybe these songs can keep that good feeling moving.",
        "Chill": "It sounds like you need something easy and steady right now. Maybe these songs can help you settle into that mood.",
    }

    return {"intro": intros[mood], "mood": mood}

@router.post("/ask")
async def ask_gemini(
    prompt: str = Form(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    subscription = ensure_user_has_subscription(db, current_user)
    plan = get_subscription_plan(db, subscription)
    if not plan.emotion_recommendations:
        raise HTTPException(status_code=403, detail="Emotion recommendations are available for Premium users only.")

    user_prompt = prompt.strip()

    if not user_prompt:
        raise HTTPException(status_code=400, detail="Prompt không được để trống!")

    if not API_KEY:
        fallback = build_local_emotion_reply(user_prompt)
        return {"reply": json.dumps(fallback)}

    final_prompt = f"""
You are an empathetic and emotionally intelligent assistant.

Context:
The user is expressing an emotional state and is looking for music suggestions. Your job is to:
1. Respond with a warm, emotionally intelligent English message that acknowledges their feelings.
2. End the message with a gentle suggestion that is personalized to the emotion (e.g., "Maybe these songs will lift your mood" if they're sad).
3. Select ONE appropriate music mood from the following list.

Respond in this exact JSON format:

{{
  "intro": "<empathetic message with a personalized ending suggestion>",
  "mood": "<ONE of: 'Lonely', 'Chill', 'Angry', 'Happy', 'Sad'>"
}}

Rules:
- Do NOT mention any song titles or artists.
- The intro must feel natural and caring.
- The ending sentence should match the emotion and gently suggest listening to music.
- The mood field must exactly match one of the five listed.

User input:
\"{user_prompt}\"
"""

    try:
        model_name = os.getenv("GEMINI_MODEL", "gemini-1.5-flash")
        model = genai.GenerativeModel(model_name)
        response = model.generate_content(final_prompt)

        # Extract the response text
        if response.candidates and response.candidates[0].content.parts:
            reply = response.candidates[0].content.parts[0].text
            return {"reply": reply}
        else:
            raise HTTPException(status_code=500, detail="Gemini không trả về dữ liệu hợp lệ.")

    except Exception as e:
        print("Gemini call failed, using local emotion fallback:", str(e))
        fallback = build_local_emotion_reply(user_prompt)
        return {"reply": json.dumps(fallback)}
