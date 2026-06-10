from datetime import datetime, timedelta
import os
from uuid import uuid4

from fastapi import APIRouter, Depends, File, Form, HTTPException, Query, Request, UploadFile
from pydantic import BaseModel
from sqlalchemy import and_, func, or_
from sqlalchemy.orm import Session

from models.base import SessionLocal
from models.notification_log import NotificationLog
from models.song import Song
from models.social import (
    SocialBlock,
    SocialComment,
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
    SocialStoryLike,
)
from models.subscription import Subscription
from models.user import User
from routes.auth_routes import get_current_artist_user, get_current_user
from utils.format_ms import format_duration
from utils.notifications import log_notification


router = APIRouter()
SOCIAL_UPLOAD_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "uploads", "social"))
ALLOWED_IMAGE_TYPES = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif"}
ALLOWED_VIDEO_TYPES = {"video/mp4": ".mp4", "video/webm": ".webm", "video/quicktime": ".mov"}
MAX_IMAGE_BYTES = 5 * 1024 * 1024
MAX_VIDEO_BYTES = 50 * 1024 * 1024


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


class MessageCreate(BaseModel):
    content: str


class LyricsUpdate(BaseModel):
    lyrics: str


def user_public(user: User | None):
    if not user:
        return {"id": None, "username": "Unknown user", "profile_picture_url": None}
    return {"id": user.id, "username": user.username, "profile_picture_url": user.profile_picture_url}


def user_summary(db: Session, user_id: str | None):
    if not user_id:
        return user_public(None)
    return user_public(db.query(User).filter(User.id == user_id).first())


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


def is_blocked_between(db: Session, user_id: str, other_user_id: str):
    return db.query(SocialBlock).filter(
        or_(
            and_(SocialBlock.blocker_id == user_id, SocialBlock.blocked_id == other_user_id),
            and_(SocialBlock.blocker_id == other_user_id, SocialBlock.blocked_id == user_id),
        )
    ).first() is not None


def friendship_state(db: Session, current_user_id: str, target_user_id: str):
    if current_user_id == target_user_id:
        return {"status": "self", "request_id": None}

    if db.query(SocialFriendship).filter(
        SocialFriendship.user_id == current_user_id,
        SocialFriendship.friend_id == target_user_id,
    ).first():
        return {"status": "friends", "request_id": None}

    incoming = db.query(SocialFriendRequest).filter(
        SocialFriendRequest.requester_id == target_user_id,
        SocialFriendRequest.addressee_id == current_user_id,
        SocialFriendRequest.status == "pending",
    ).first()
    if incoming:
        return {"status": "incoming", "request_id": incoming.id}

    outgoing = db.query(SocialFriendRequest).filter(
        SocialFriendRequest.requester_id == current_user_id,
        SocialFriendRequest.addressee_id == target_user_id,
        SocialFriendRequest.status == "pending",
    ).first()
    if outgoing:
        return {"status": "outgoing", "request_id": outgoing.id}

    return {"status": "none", "request_id": None}


def ensure_friendship(db: Session, user_id: str, friend_id: str):
    existing = db.query(SocialFriendship).filter(
        SocialFriendship.user_id == user_id,
        SocialFriendship.friend_id == friend_id,
    ).first()
    if not existing:
        db.add(SocialFriendship(user_id=user_id, friend_id=friend_id))


def serialize_story(db: Session, story: SocialStory, current_user_id: str):
    media_url = story.media_url or story.image_url
    media_type = story.media_type or ("image" if story.image_url else None)
    comments = (
        db.query(SocialStoryComment, User)
        .join(User, User.id == SocialStoryComment.user_id)
        .filter(SocialStoryComment.story_id == story.id)
        .order_by(SocialStoryComment.created_at.asc())
        .limit(50)
        .all()
    )
    like_count = db.query(func.count(SocialStoryLike.id)).filter(SocialStoryLike.story_id == story.id).scalar() or 0
    comment_count = db.query(func.count(SocialStoryComment.id)).filter(SocialStoryComment.story_id == story.id).scalar() or 0
    is_liked = db.query(SocialStoryLike).filter(
        SocialStoryLike.story_id == story.id,
        SocialStoryLike.user_id == current_user_id,
    ).first() is not None
    return {
        "id": story.id,
        "content": story.content,
        "image_url": story.image_url,
        "media_url": media_url,
        "media_type": media_type,
        "track": track_public(db, story.track_id),
        "story_type": story.story_type,
        "created_at": story.created_at.isoformat(),
        "author": user_summary(db, story.user_id),
        "is_owner": story.user_id == current_user_id,
        "like_count": like_count,
        "comment_count": comment_count,
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


def serialize_message(db: Session, message: SocialMessage, current_user_id: str):
    return {
        "id": message.id,
        "content": message.content,
        "created_at": message.created_at.isoformat(),
        "is_mine": message.sender_id == current_user_id,
        "sender": user_summary(db, message.sender_id),
        "recipient": user_summary(db, message.recipient_id),
        "read_at": message.read_at.isoformat() if message.read_at else None,
    }


def serialize_post(db: Session, post: SocialPost, current_user_id: str):
    media_url = post.media_url or post.image_url
    media_type = post.media_type or ("image" if post.image_url else None)
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
        "media_url": media_url,
        "media_type": media_type,
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


async def save_social_story_media(media: UploadFile | None, request: Request):
    if not media or not media.filename:
        return None, None

    image_extension = ALLOWED_IMAGE_TYPES.get(media.content_type)
    video_extension = ALLOWED_VIDEO_TYPES.get(media.content_type)
    extension = image_extension or video_extension
    if not extension:
        raise HTTPException(status_code=400, detail="Only images or MP4/WebM/MOV videos are supported")

    contents = await media.read()
    media_type = "image" if image_extension else "video"
    max_bytes = MAX_IMAGE_BYTES if media_type == "image" else MAX_VIDEO_BYTES
    if len(contents) > max_bytes:
        limit = "5 MB" if media_type == "image" else "50 MB"
        raise HTTPException(status_code=400, detail=f"{media_type.title()} must be {limit} or smaller")

    os.makedirs(SOCIAL_UPLOAD_DIR, exist_ok=True)
    file_name = f"{uuid4().hex}{extension}"
    file_path = os.path.join(SOCIAL_UPLOAD_DIR, file_name)
    with open(file_path, "wb") as file:
        file.write(contents)

    return str(request.base_url).rstrip("/") + f"/uploads/social/{file_name}", media_type


async def save_social_media(media: UploadFile | None, request: Request):
    return await save_social_story_media(media, request)


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
    media: UploadFile | None = File(None),
    image: UploadFile | None = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_not_muted(current_user)
    post_content = content.strip()
    upload = media or image
    if not post_content and not upload:
        raise HTTPException(status_code=400, detail="Post content or media is required")

    if track_id and not db.query(Song).filter(Song.track_id == track_id).first():
        raise HTTPException(status_code=404, detail="Track not found")

    media_url, media_type = await save_social_media(upload, request)
    post = SocialPost(
        user_id=current_user.id,
        content=post_content or ("Shared a video" if media_type == "video" else "Shared a photo"),
        track_id=track_id,
        image_url=media_url if media_type == "image" else None,
        media_url=media_url,
        media_type=media_type or "image",
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
        media_url=original.media_url,
        media_type=original.media_type,
        shared_post_id=original.id,
    )
    db.add(share)
    db.add(post)
    if original.user_id != current_user.id:
        notify(db, original.user_id, "post_shared", "New share", f"{current_user.username} shared your post.")
    db.commit()
    db.refresh(post)
    return serialize_post(db, post, current_user.id)


@router.get("/stories")
def get_stories(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    since = datetime.utcnow() - timedelta(hours=24)
    friend_ids = [
        row.friend_id
        for row in db.query(SocialFriendship).filter(SocialFriendship.user_id == current_user.id).all()
    ]
    following_ids = [
        row.following_id
        for row in db.query(SocialFollow).filter(SocialFollow.follower_id == current_user.id).all()
    ]
    visible_user_ids = list({current_user.id, *friend_ids, *following_ids})

    stories = (
        db.query(SocialStory)
        .filter(
            SocialStory.user_id.in_(visible_user_ids),
            or_(SocialStory.story_type == "reel", SocialStory.created_at >= since),
        )
        .order_by(SocialStory.created_at.desc())
        .limit(40)
        .all()
    )
    return [serialize_story(db, story, current_user.id) for story in stories]


@router.post("/stories/photo")
async def create_story(
    request: Request,
    content: str = Form(""),
    track_id: str | None = Form(None),
    story_type: str = Form("story"),
    media: UploadFile | None = File(None),
    image: UploadFile | None = File(None),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_not_muted(current_user)
    story_content = content.strip()
    clean_story_type = story_type.strip().lower()
    if clean_story_type not in {"story", "reel"}:
        raise HTTPException(status_code=400, detail="Story type must be story or reel")
    upload = media or image
    if not story_content and not upload and not track_id:
        raise HTTPException(status_code=400, detail="Story content, media, or song is required")

    if track_id and not db.query(Song).filter(Song.track_id == track_id).first():
        raise HTTPException(status_code=404, detail="Track not found")

    media_url, media_type = await save_social_story_media(upload, request)
    story = SocialStory(
        user_id=current_user.id,
        content=story_content,
        image_url=media_url if media_type == "image" else None,
        media_url=media_url,
        media_type=media_type or "image",
        track_id=track_id,
        story_type=clean_story_type,
    )
    db.add(story)
    db.commit()
    db.refresh(story)
    return serialize_story(db, story, current_user.id)


@router.delete("/stories/{story_id}")
def delete_story(story_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    story = db.query(SocialStory).filter(SocialStory.id == story_id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    if story.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only delete your own stories")

    db.delete(story)
    db.commit()
    return {"message": "Story deleted", "story_id": story_id}


@router.post("/stories/{story_id}/like")
def toggle_story_like(story_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    story = db.query(SocialStory).filter(SocialStory.id == story_id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    if is_blocked_between(db, current_user.id, story.user_id):
        raise HTTPException(status_code=403, detail="You cannot interact with this reel")

    existing = db.query(SocialStoryLike).filter(
        SocialStoryLike.story_id == story_id,
        SocialStoryLike.user_id == current_user.id,
    ).first()
    if existing:
        db.delete(existing)
    else:
        db.add(SocialStoryLike(story_id=story_id, user_id=current_user.id))
        if story.user_id != current_user.id:
            notify(db, story.user_id, "social_like", "New like", f"{current_user.username} liked your {story.story_type}.")

    db.commit()
    db.refresh(story)
    return {"story": serialize_story(db, story, current_user.id)}


@router.post("/stories/{story_id}/comments")
def add_story_comment(
    story_id: str,
    payload: CommentCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    require_not_muted(current_user)
    story = db.query(SocialStory).filter(SocialStory.id == story_id).first()
    if not story:
        raise HTTPException(status_code=404, detail="Story not found")
    if is_blocked_between(db, current_user.id, story.user_id):
        raise HTTPException(status_code=403, detail="You cannot comment on this reel")

    content = payload.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="Comment is required")

    db.add(SocialStoryComment(story_id=story_id, user_id=current_user.id, content=content))
    if story.user_id != current_user.id:
        notify(db, story.user_id, "social_comment", "New comment", f"{current_user.username} commented on your {story.story_type}.")
    db.commit()
    db.refresh(story)
    return {"story": serialize_story(db, story, current_user.id)}


@router.get("/friends")
def get_friends(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    friend_rows = db.query(SocialFriendship).filter(SocialFriendship.user_id == current_user.id).all()
    friends = [
        user_summary(db, row.friend_id)
        for row in friend_rows
    ]

    incoming_rows = db.query(SocialFriendRequest).filter(
        SocialFriendRequest.addressee_id == current_user.id,
        SocialFriendRequest.status == "pending",
    ).order_by(SocialFriendRequest.created_at.desc()).all()
    outgoing_rows = db.query(SocialFriendRequest).filter(
        SocialFriendRequest.requester_id == current_user.id,
        SocialFriendRequest.status == "pending",
    ).order_by(SocialFriendRequest.created_at.desc()).all()

    excluded_ids = {current_user.id, *[friend["id"] for friend in friends]}
    excluded_ids.update(row.requester_id for row in incoming_rows)
    excluded_ids.update(row.addressee_id for row in outgoing_rows)
    suggestions_query = db.query(User).filter(User.id != current_user.id).order_by(User.username.asc()).limit(50).all()
    suggestions = [
        user_public(user)
        for user in suggestions_query
        if user.id not in excluded_ids
    ][:8]

    return {
        "friends": friends,
        "incoming_requests": [
            {
                "id": row.id,
                "created_at": row.created_at.isoformat(),
                "user": user_summary(db, row.requester_id),
            }
            for row in incoming_rows
        ],
        "outgoing_requests": [
            {
                "id": row.id,
                "created_at": row.created_at.isoformat(),
                "user": user_summary(db, row.addressee_id),
            }
            for row in outgoing_rows
        ],
        "suggestions": suggestions,
    }


@router.post("/friends/requests/{user_id}")
def request_friend(user_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot add yourself")

    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    state = friendship_state(db, current_user.id, user_id)
    if state["status"] == "friends":
        return {"status": "friends"}

    if state["status"] == "incoming" and state["request_id"]:
        return accept_friend_request(state["request_id"], db, current_user)

    existing = db.query(SocialFriendRequest).filter(
        SocialFriendRequest.requester_id == current_user.id,
        SocialFriendRequest.addressee_id == user_id,
    ).first()
    if existing:
        existing.status = "pending"
        existing.updated_at = datetime.utcnow()
        request = existing
    else:
        request = SocialFriendRequest(requester_id=current_user.id, addressee_id=user_id)
        db.add(request)

    notify(db, user_id, "friend_request", "Friend request", f"{current_user.username} sent you a friend request.")
    db.commit()
    db.refresh(request)
    return {"status": "outgoing", "request_id": request.id}


@router.put("/friends/requests/{request_id}/accept")
def accept_friend_request(request_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    request = db.query(SocialFriendRequest).filter(SocialFriendRequest.id == request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="Friend request not found")
    if request.addressee_id != current_user.id:
        raise HTTPException(status_code=403, detail="You can only accept requests sent to you")

    request.status = "accepted"
    request.updated_at = datetime.utcnow()
    ensure_friendship(db, request.requester_id, request.addressee_id)
    ensure_friendship(db, request.addressee_id, request.requester_id)
    notify(db, request.requester_id, "friend_request_accepted", "Friend request accepted", f"{current_user.username} accepted your friend request.")
    db.commit()
    return {"status": "friends", "friend": user_summary(db, request.requester_id)}


@router.delete("/friends/requests/{request_id}")
def remove_friend_request(request_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    request = db.query(SocialFriendRequest).filter(SocialFriendRequest.id == request_id).first()
    if not request:
        raise HTTPException(status_code=404, detail="Friend request not found")
    if current_user.id not in {request.requester_id, request.addressee_id}:
        raise HTTPException(status_code=403, detail="You cannot update this request")

    db.delete(request)
    db.commit()
    return {"status": "removed", "request_id": request_id}


@router.delete("/friends/{user_id}")
def remove_friend(user_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    db.query(SocialFriendship).filter(
        or_(
            and_(SocialFriendship.user_id == current_user.id, SocialFriendship.friend_id == user_id),
            and_(SocialFriendship.user_id == user_id, SocialFriendship.friend_id == current_user.id),
        )
    ).delete(synchronize_session=False)
    db.commit()
    return {"status": "removed", "user_id": user_id}


@router.post("/users/{user_id}/block")
def block_user(user_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot block yourself")
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    existing = db.query(SocialBlock).filter(
        SocialBlock.blocker_id == current_user.id,
        SocialBlock.blocked_id == user_id,
    ).first()
    if not existing:
        db.add(SocialBlock(blocker_id=current_user.id, blocked_id=user_id))
        db.query(SocialFriendship).filter(
            or_(
                and_(SocialFriendship.user_id == current_user.id, SocialFriendship.friend_id == user_id),
                and_(SocialFriendship.user_id == user_id, SocialFriendship.friend_id == current_user.id),
            )
        ).delete(synchronize_session=False)
        db.query(SocialFollow).filter(
            or_(
                and_(SocialFollow.follower_id == current_user.id, SocialFollow.following_id == user_id),
                and_(SocialFollow.follower_id == user_id, SocialFollow.following_id == current_user.id),
            )
        ).delete(synchronize_session=False)
        db.commit()
    return {"status": "blocked", "user_id": user_id}


@router.delete("/users/{user_id}/block")
def unblock_user(user_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    db.query(SocialBlock).filter(
        SocialBlock.blocker_id == current_user.id,
        SocialBlock.blocked_id == user_id,
    ).delete(synchronize_session=False)
    db.commit()
    return {"status": "unblocked", "user_id": user_id}


@router.post("/users/{user_id}/mute")
def mute_user(user_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot mute yourself")
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    existing = db.query(SocialMute).filter(SocialMute.muter_id == current_user.id, SocialMute.muted_id == user_id).first()
    if not existing:
        db.add(SocialMute(muter_id=current_user.id, muted_id=user_id))
        db.commit()
    return {"status": "muted", "user_id": user_id}


@router.delete("/users/{user_id}/mute")
def unmute_user(user_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    db.query(SocialMute).filter(SocialMute.muter_id == current_user.id, SocialMute.muted_id == user_id).delete(synchronize_session=False)
    db.commit()
    return {"status": "unmuted", "user_id": user_id}


@router.get("/messages/threads")
def get_message_threads(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    rows = (
        db.query(SocialMessage)
        .filter(or_(SocialMessage.sender_id == current_user.id, SocialMessage.recipient_id == current_user.id))
        .order_by(SocialMessage.created_at.desc())
        .limit(200)
        .all()
    )
    threads = {}
    for message in rows:
        partner_id = message.recipient_id if message.sender_id == current_user.id else message.sender_id
        if is_blocked_between(db, current_user.id, partner_id):
            continue
        if partner_id not in threads:
            threads[partner_id] = {
                "user": user_summary(db, partner_id),
                "latest_message": serialize_message(db, message, current_user.id),
                "unread_count": 0,
            }
        if message.recipient_id == current_user.id and message.read_at is None:
            threads[partner_id]["unread_count"] += 1

    return list(threads.values())


@router.get("/messages/{user_id}")
def get_messages(user_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if is_blocked_between(db, current_user.id, user_id):
        raise HTTPException(status_code=403, detail="Messages are unavailable for this profile")

    messages = (
        db.query(SocialMessage)
        .filter(
            or_(
                and_(SocialMessage.sender_id == current_user.id, SocialMessage.recipient_id == user_id),
                and_(SocialMessage.sender_id == user_id, SocialMessage.recipient_id == current_user.id),
            )
        )
        .order_by(SocialMessage.created_at.asc())
        .limit(100)
        .all()
    )
    unread = [message for message in messages if message.recipient_id == current_user.id and message.read_at is None]
    for message in unread:
        message.read_at = datetime.utcnow()
    if unread:
        db.commit()

    return {
        "user": user_public(target),
        "messages": [serialize_message(db, message, current_user.id) for message in messages],
    }


@router.post("/messages/{user_id}")
def send_message(user_id: str, payload: MessageCreate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    target = db.query(User).filter(User.id == user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="You cannot message yourself")
    if is_blocked_between(db, current_user.id, user_id):
        raise HTTPException(status_code=403, detail="Messages are unavailable for this profile")

    content = payload.content.strip()
    if not content:
        raise HTTPException(status_code=400, detail="Message content is required")

    message = SocialMessage(sender_id=current_user.id, recipient_id=user_id, content=content)
    db.add(message)
    notify(db, user_id, "new_message", "New message", f"{current_user.username} sent you a message.")
    db.commit()
    db.refresh(message)
    return serialize_message(db, message, current_user.id)


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
            "profile_picture_url": user.profile_picture_url,
            "is_following": user.id in following,
            "friendship": friendship_state(db, current_user.id, user.id),
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
def update_lyrics(track_id: str, payload: LyricsUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_artist_user)):
    song = db.query(Song).filter(Song.track_id == track_id).first()
    if not song:
        raise HTTPException(status_code=404, detail="Track not found")
    song.lyrics = payload.lyrics
    db.commit()
    return {"track_id": song.track_id, "lyrics": song.lyrics}
