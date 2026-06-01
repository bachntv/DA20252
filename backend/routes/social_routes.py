from datetime import datetime, timedelta
import os
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile
from pydantic import BaseModel
from sqlalchemy import func, or_
from sqlalchemy.orm import Session

from models.base import SessionLocal
from models.notification_log import NotificationLog
from models.song import Song
from models.social import SocialComment, SocialFollow, SocialLike, SocialPost, SocialShare
from models.subscription import Subscription
from models.user import User
from routes.auth_routes import get_current_user
from utils.format_ms import format_duration
from utils.notifications import log_notification


router = APIRouter()
SOCIAL_UPLOAD_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "uploads", "social"))
ALLOWED_IMAGE_TYPES = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif"}
MAX_IMAGE_BYTES = 5 * 1024 * 1024


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


class PostCreate(BaseModel):
    content: str
    track_id: str | None = None


class CommentCreate(BaseModel):
    content: str


class ContentUpdate(BaseModel):
    content: str


class ShareCreate(BaseModel):
    content: str | None = None


class LyricsUpdate(BaseModel):
    lyrics: str


def user_public(user: User | None):
    if not user:
        return {"id": None, "username": "Unknown user"}
    return {"id": user.id, "username": user.username}


def track_public(db: Session, track_id: str | None):
    if not track_id:
        return None

    song = db.query(Song).filter(Song.track_id == track_id).first()
    if not song:
        return None

    return {
        "id": song.track_id,
        "title": song.track_name,
        "artist_id": song.artist_id,
        "album_id": song.album_id,
        "duration": format_duration(song.duration_ms),
        "cover_url": song.track_image_url,
        "lyrics": song.lyrics,
    }


def notify(db: Session, user_id: str | None, event_type: str, title: str, message: str):
    if not user_id:
        return
    log_notification(
        db,
        user_id=user_id,
        event_type=event_type,
        title=title,
        message=message,
    )


def require_not_muted(user: User):
    if user.is_muted:
        raise HTTPException(status_code=403, detail="This account is muted and cannot post, comment, or share")


def serialize_post(db: Session, post: SocialPost, current_user_id: str):
    author = db.query(User).filter(User.id == post.user_id).first()
    comments = (
        db.query(SocialComment, User)
        .join(User, User.id == SocialComment.user_id)
        .filter(SocialComment.post_id == post.id)
        .order_by(SocialComment.created_at.asc())
        .limit(20)
        .all()
    )
    like_count = db.query(func.count(SocialLike.id)).filter(SocialLike.post_id == post.id).scalar() or 0
    comment_count = db.query(func.count(SocialComment.id)).filter(SocialComment.post_id == post.id).scalar() or 0
    share_count = db.query(func.count(SocialShare.id)).filter(SocialShare.post_id == post.id).scalar() or 0
    is_liked = db.query(SocialLike).filter(
        SocialLike.post_id == post.id,
        SocialLike.user_id == current_user_id,
    ).first() is not None

    return {
        "id": post.id,
        "content": post.content,
        "created_at": post.created_at.isoformat(),
        "author": user_public(author),
        "track": track_public(db, post.track_id),
        "image_url": post.image_url,
        "shared_post_id": post.shared_post_id,
        "is_owner": post.user_id == current_user_id,
        "like_count": like_count,
        "comment_count": comment_count,
        "share_count": share_count,
        "is_liked": is_liked,
        "comments": [
            {
                "id": comment.id,
                "content": comment.content,
                "created_at": comment.created_at.isoformat(),
                "author": user_public(user),
                "is_owner": comment.user_id == current_user_id,
            }
            for comment, user in comments
        ],
    }


async def save_social_image(image: UploadFile | None, request: Request):
    if not image or not image.filename:
        return None

    extension = ALLOWED_IMAGE_TYPES.get(image.content_type)
    if not extension:
        raise HTTPException(status_code=400, detail="Only JPG, PNG, WebP, or GIF images are supported")

    contents = await image.read()
    if len(contents) > MAX_IMAGE_BYTES:
        raise HTTPException(status_code=400, detail="Image must be 5 MB or smaller")

    os.makedirs(SOCIAL_UPLOAD_DIR, exist_ok=True)
    file_name = f"{uuid4().hex}{extension}"
    file_path = os.path.join(SOCIAL_UPLOAD_DIR, file_name)
    with open(file_path, "wb") as file:
        file.write(contents)

    return str(request.base_url).rstrip("/") + f"/uploads/social/{file_name}"


@router.get("/feed")
def get_feed(
    scope: str = Query("all", regex="^(all|following)$"),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    query = db.query(SocialPost)
    if scope == "following":
        following_ids = [
            row.following_id
            for row in db.query(SocialFollow).filter(SocialFollow.follower_id == current_user.id).all()
        ]
        query = query.filter(or_(SocialPost.user_id.in_(following_ids), SocialPost.user_id == current_user.id))

    posts = query.order_by(SocialPost.created_at.desc()).limit(50).all()
    return [serialize_post(db, post, current_user.id) for post in posts]


@router.post("/posts")
def create_post(payload: PostCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    require_not_muted(current_user)
    content = payload.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="Post content is required")

    if payload.track_id and not db.query(Song).filter(Song.track_id == payload.track_id).first():
        raise HTTPException(status_code=404, detail="Track not found")

    post = SocialPost(user_id=current_user.id, content=content, track_id=payload.track_id)
    db.add(post)
    db.flush()

    followers = db.query(SocialFollow).filter(SocialFollow.following_id == current_user.id).all()
    for follow in followers:
        notify(
            db,
            follow.follower_id,
            "followed_user_posted",
            "New post",
            f"{current_user.username} just posted something new.",
        )

    db.commit()
    db.refresh(post)
    return serialize_post(db, post, current_user.id)


@router.post("/posts/photo")
async def create_photo_post(
    request: Request,
    content: str = Form(""),
    track_id: str | None = Form(None),
    image: UploadFile | None = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_not_muted(current_user)
    post_content = content.strip()
    if not post_content and not image:
        raise HTTPException(status_code=400, detail="Post content or photo is required")

    if track_id and not db.query(Song).filter(Song.track_id == track_id).first():
        raise HTTPException(status_code=404, detail="Track not found")

    image_url = await save_social_image(image, request)
    post = SocialPost(
        user_id=current_user.id,
        content=post_content or "Shared a photo",
        track_id=track_id,
        image_url=image_url,
    )
    db.add(post)
    db.flush()

    followers = db.query(SocialFollow).filter(SocialFollow.following_id == current_user.id).all()
    for follow in followers:
        notify(
            db,
            follow.follower_id,
            "followed_user_posted",
            "New post",
            f"{current_user.username} just posted something new.",
        )

    db.commit()
    db.refresh(post)
    return serialize_post(db, post, current_user.id)


@router.put("/posts/{post_id}")
def update_post(post_id: str, payload: ContentUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    post = db.query(SocialPost).filter(SocialPost.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if post.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only edit your own posts")

    content = payload.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="Post content is required")

    post.content = content
    post.updated_at = datetime.utcnow()
    db.commit()
    db.refresh(post)
    return serialize_post(db, post, current_user.id)


@router.delete("/posts/{post_id}")
def delete_post(post_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    post = db.query(SocialPost).filter(SocialPost.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")
    if post.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only delete your own posts")

    db.query(SocialComment).filter(SocialComment.post_id == post_id).delete(synchronize_session=False)
    db.query(SocialLike).filter(SocialLike.post_id == post_id).delete(synchronize_session=False)
    db.query(SocialShare).filter(SocialShare.post_id == post_id).delete(synchronize_session=False)
    db.query(SocialPost).filter(SocialPost.shared_post_id == post_id).update(
        {"shared_post_id": None},
        synchronize_session=False,
    )
    db.delete(post)
    db.commit()
    return {"message": "Post deleted", "post_id": post_id}


@router.post("/posts/{post_id}/like")
def toggle_like(post_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    post = db.query(SocialPost).filter(SocialPost.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    existing = db.query(SocialLike).filter(SocialLike.post_id == post_id, SocialLike.user_id == current_user.id).first()
    if existing:
        db.delete(existing)
        liked = False
    else:
        db.add(SocialLike(post_id=post_id, user_id=current_user.id))
        liked = True
        if post.user_id != current_user.id:
            notify(db, post.user_id, "post_liked", "New like", f"{current_user.username} liked your post.")

    db.commit()
    return {"liked": liked, "post": serialize_post(db, post, current_user.id)}


@router.post("/posts/{post_id}/comments")
def add_comment(post_id: str, payload: CommentCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    require_not_muted(current_user)
    post = db.query(SocialPost).filter(SocialPost.id == post_id).first()
    if not post:
        raise HTTPException(status_code=404, detail="Post not found")

    content = payload.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="Comment content is required")

    comment = SocialComment(post_id=post_id, user_id=current_user.id, content=content)
    db.add(comment)
    if post.user_id != current_user.id:
        notify(db, post.user_id, "post_commented", "New comment", f"{current_user.username} commented on your post.")
    db.commit()
    return serialize_post(db, post, current_user.id)


@router.put("/comments/{comment_id}")
def update_comment(comment_id: str, payload: ContentUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    comment = db.query(SocialComment).filter(SocialComment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    if comment.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only edit your own comments")

    content = payload.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="Comment content is required")

    comment.content = content
    post = db.query(SocialPost).filter(SocialPost.id == comment.post_id).first()
    db.commit()
    return serialize_post(db, post, current_user.id)


@router.delete("/comments/{comment_id}")
def delete_comment(comment_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    comment = db.query(SocialComment).filter(SocialComment.id == comment_id).first()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found")
    if comment.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only delete your own comments")

    post = db.query(SocialPost).filter(SocialPost.id == comment.post_id).first()
    db.delete(comment)
    db.commit()
    return serialize_post(db, post, current_user.id)


@router.post("/posts/{post_id}/share")
def share_post(post_id: str, payload: ShareCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    require_not_muted(current_user)
    original = db.query(SocialPost).filter(SocialPost.id == post_id).first()
    if not original:
        raise HTTPException(status_code=404, detail="Post not found")

    share = SocialShare(post_id=post_id, user_id=current_user.id)
    post = SocialPost(
        user_id=current_user.id,
        content=(payload.content or f"Shared a post").strip(),
        track_id=original.track_id,
        image_url=original.image_url,
        shared_post_id=original.id,
    )
    db.add(share)
    db.add(post)
    if original.user_id != current_user.id:
        notify(db, original.user_id, "post_shared", "New share", f"{current_user.username} shared your post.")
    db.commit()
    db.refresh(post)
    return serialize_post(db, post, current_user.id)


@router.get("/users")
def search_users(q: str = "", db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    users = (
        db.query(User)
        .filter(User.id != current_user.id, User.username.ilike(f"%{q}%"))
        .order_by(User.username.asc())
        .limit(20)
        .all()
    )
    following = {
        row.following_id
        for row in db.query(SocialFollow).filter(SocialFollow.follower_id == current_user.id).all()
    }
    return [
        {
            "id": user.id,
            "username": user.username,
            "is_following": user.id in following,
        }
        for user in users
    ]


@router.post("/users/{user_id}/follow")
def follow_user(user_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot follow yourself")
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    existing = db.query(SocialFollow).filter(
        SocialFollow.follower_id == current_user.id,
        SocialFollow.following_id == user_id,
    ).first()
    if existing:
        return {"following": True}

    db.add(SocialFollow(follower_id=current_user.id, following_id=user_id))
    notify(db, user_id, "new_follower", "New follower", f"{current_user.username} started following you.")
    db.commit()
    return {"following": True}


@router.delete("/users/{user_id}/follow")
def unfollow_user(user_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    existing = db.query(SocialFollow).filter(
        SocialFollow.follower_id == current_user.id,
        SocialFollow.following_id == user_id,
    ).first()
    if existing:
        db.delete(existing)
        db.commit()
    return {"following": False}


@router.get("/notifications")
def get_notifications(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    subscription = (
        db.query(Subscription)
        .filter(Subscription.user_id == current_user.id, Subscription.status == "active")
        .order_by(Subscription.expires_at.desc().nullslast())
        .first()
    )
    if subscription and subscription.expires_at:
        days_left = (subscription.expires_at - datetime.utcnow()).days
        if days_left <= 7:
            existing = db.query(NotificationLog).filter(
                NotificationLog.user_id == current_user.id,
                NotificationLog.event_type == "subscription_renewal",
                NotificationLog.created_at >= datetime.utcnow() - timedelta(days=1),
            ).first()
            if not existing:
                notify(
                    db,
                    current_user.id,
                    "subscription_renewal",
                    "Subscription renewal",
                    f"Your subscription renews on {subscription.expires_at.date().isoformat()}.",
                )
                db.commit()

    rows = (
        db.query(NotificationLog)
        .filter(NotificationLog.user_id == current_user.id)
        .order_by(NotificationLog.created_at.desc())
        .limit(30)
        .all()
    )
    return [
        {
            "id": row.id,
            "event_type": row.event_type,
            "title": row.title,
            "message": row.message,
            "is_read": row.is_read,
            "created_at": row.created_at.isoformat(),
        }
        for row in rows
    ]


@router.post("/notifications/read")
def mark_notifications_read(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    db.query(NotificationLog).filter(NotificationLog.user_id == current_user.id).update({"is_read": True})
    db.commit()
    return {"ok": True}


@router.get("/tracks/{track_id}/lyrics")
def get_lyrics(track_id: str, db: Session = Depends(get_db)):
    song = db.query(Song).filter(Song.track_id == track_id).first()
    if not song:
        raise HTTPException(status_code=404, detail="Track not found")
    return {"track_id": song.track_id, "title": song.track_name, "lyrics": song.lyrics or ""}


@router.put("/tracks/{track_id}/lyrics")
def update_lyrics(track_id: str, payload: LyricsUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    song = db.query(Song).filter(Song.track_id == track_id).first()
    if not song:
        raise HTTPException(status_code=404, detail="Track not found")
    song.lyrics = payload.lyrics
    db.commit()
    return {"track_id": song.track_id, "lyrics": song.lyrics}
