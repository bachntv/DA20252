import os
from uuid import uuid4

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from sqlalchemy import or_
from sqlalchemy.orm import Session
from typing import Optional
from jose import jwt, JWTError
from datetime import datetime, timedelta
from pydantic import BaseModel

from models.base import SessionLocal
from models.user import User
from models.plan import Plan
from models.playlist import Playlist
from models.playlist_tracks import PlaylistTracks
from models.playlist_user import PlaylistUser
from models.song import Song
from models.song_purchase import SongPurchase
from models.social import SocialBlock, SocialFollow, SocialFriendship, SocialMute, SocialPost, SocialStory, SocialStoryView
from schemas.user import UserUpdate
from schemas.billing import BillingOverview, PlanResponse, SubscriptionSummary, PaymentResponse, SubscribeRequest, PaymentActionRequest
from .auth_routes import get_current_user
from utils.password import verify_password, hash_password
from utils.activity import log_activity
from utils.billing import (
    ensure_user_has_subscription,
    get_subscription_plan,
    ensure_default_plans,
    get_pending_subscription,
    upgrade_subscription,
    confirm_payment,
    fail_payment,
    cancel_subscription,
    list_recent_payments,
    renew_subscription,
)

router = APIRouter()
PROFILE_UPLOAD_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "uploads", "profiles"))
ALLOWED_PROFILE_IMAGE_TYPES = {"image/jpeg": ".jpg", "image/png": ".png", "image/webp": ".webp", "image/gif": ".gif"}
MAX_PROFILE_IMAGE_BYTES = 5 * 1024 * 1024

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Schema for changing password
class PasswordChange(BaseModel):
    current_password: str
    new_password: str


class ProfileThemeUpdate(BaseModel):
    profile_background_color: str


async def save_profile_picture(image: UploadFile, request: Request):
    extension = ALLOWED_PROFILE_IMAGE_TYPES.get(image.content_type)
    if not image or not image.filename or not extension:
        raise HTTPException(status_code=400, detail="Only JPG, PNG, WebP, or GIF profile pictures are supported")

    contents = await image.read()
    if len(contents) > MAX_PROFILE_IMAGE_BYTES:
        raise HTTPException(status_code=400, detail="Profile picture must be 5 MB or smaller")

    os.makedirs(PROFILE_UPLOAD_DIR, exist_ok=True)
    file_name = f"{uuid4().hex}{extension}"
    file_path = os.path.join(PROFILE_UPLOAD_DIR, file_name)
    with open(file_path, "wb") as file:
        file.write(contents)

    return str(request.base_url).rstrip("/") + f"/uploads/profiles/{file_name}"


def serialize_private_user(user: User):
    return {
        "id": user.id,
        "username": user.username,
        "email": user.email,
        "roles": user.roles,
        "account_type": user.account_type,
        "profile_picture_url": user.profile_picture_url,
        "cover_photo_url": user.cover_photo_url,
        "profile_background_color": user.profile_background_color,
    }


def serialize_public_profile_user(user: Optional[User]):
    if not user:
        return None
    return {
        "id": user.id,
        "username": user.username,
        "profile_picture_url": user.profile_picture_url,
        "roles": user.roles,
    }


def users_are_friends(db: Session, user_id: str, friend_id: str) -> bool:
    if user_id == friend_id:
        return True
    return db.query(SocialFriendship).filter(
        SocialFriendship.user_id == user_id,
        SocialFriendship.friend_id == friend_id,
    ).first() is not None


def can_view_profile_audience(db: Session, owner_id: str, viewer_id: str, audience: Optional[str]) -> bool:
    if owner_id == viewer_id:
        return True
    if audience == "private":
        return False
    if audience == "friends":
        return users_are_friends(db, owner_id, viewer_id)
    return True

# Get current user profile
@router.get("/me", response_model=UserUpdate)
def get_my_profile(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    subscription = ensure_user_has_subscription(db, current_user)
    plan = get_subscription_plan(db, subscription)
    current_user.account_type = plan.code
    db.commit()
    return {
        "username": current_user.username,
        "email": current_user.email,
        "birthdate": current_user.birthdate,
        "gender": current_user.gender,
        "account_type": current_user.account_type,
        "profile_picture_url": current_user.profile_picture_url,
        "cover_photo_url": current_user.cover_photo_url,
        "profile_background_color": current_user.profile_background_color,
    }

# Update current user profile
@router.put("/me")
def update_my_profile(update: UserUpdate, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    user = db.query(User).filter(User.id == current_user.id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    user.username = update.username or user.username
    user.email = update.email or user.email
    user.birthdate = update.birthdate or user.birthdate
    user.gender = update.gender or user.gender

    db.commit()
    db.refresh(user)
    log_activity(db, user.id, "update_profile", "user", user.id, "Updated account profile")
    return {"message": "Profile updated successfully"}


@router.post("/me/profile-picture")
async def update_profile_picture(
    request: Request,
    image: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    user = db.query(User).filter(User.id == current_user.id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    image_url = await save_profile_picture(image, request)
    user.profile_picture_url = image_url
    db.commit()
    db.refresh(user)
    log_activity(db, user.id, "update_profile_picture", "user", user.id, "Updated profile picture")
    return {
        "message": "Profile picture updated",
        "profile_picture_url": user.profile_picture_url,
        "user": serialize_private_user(user),
    }


@router.post("/me/cover-photo")
async def update_cover_photo(
    request: Request,
    image: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    user = db.query(User).filter(User.id == current_user.id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    image_url = await save_profile_picture(image, request)
    user.cover_photo_url = image_url
    db.commit()
    db.refresh(user)
    log_activity(db, user.id, "update_cover_photo", "user", user.id, "Updated profile cover photo")
    return {
        "message": "Cover photo updated",
        "cover_photo_url": user.cover_photo_url,
        "user": serialize_private_user(user),
    }


@router.put("/me/profile-theme")
def update_profile_theme(
    payload: ProfileThemeUpdate,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    user = db.query(User).filter(User.id == current_user.id).first()
    if not user:
      raise HTTPException(status_code=404, detail="User not found")

    color = (payload.profile_background_color or "").strip()
    if not color.startswith("#") or len(color) not in {4, 7}:
        raise HTTPException(status_code=400, detail="Use a hex color like #1877f2")

    user.profile_background_color = color
    db.commit()
    db.refresh(user)
    log_activity(db, user.id, "update_profile_theme", "user", user.id, "Updated profile background color")
    return {
        "message": "Profile color updated",
        "profile_background_color": user.profile_background_color,
        "user": serialize_private_user(user),
    }


@router.get("/profile/{user_id}")
def get_public_profile(user_id: str, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    post_count = db.query(SocialPost).filter(SocialPost.user_id == user.id).count()
    follower_count = db.query(SocialFollow).filter(SocialFollow.following_id == user.id).count()
    following_count = db.query(SocialFollow).filter(SocialFollow.follower_id == user.id).count()
    friend_count = db.query(SocialFriendship).filter(SocialFriendship.user_id == user.id).count()
    owned_song_count = db.query(SongPurchase).filter(SongPurchase.user_id == user.id, SongPurchase.status == "owned").count()
    is_following = db.query(SocialFollow).filter(
        SocialFollow.follower_id == current_user.id,
        SocialFollow.following_id == user.id,
    ).first() is not None
    is_muted = db.query(SocialMute).filter(SocialMute.muter_id == current_user.id, SocialMute.muted_id == user.id).first() is not None
    is_blocked = db.query(SocialBlock).filter(SocialBlock.blocker_id == current_user.id, SocialBlock.blocked_id == user.id).first() is not None
    has_blocked_you = db.query(SocialBlock).filter(SocialBlock.blocker_id == user.id, SocialBlock.blocked_id == current_user.id).first() is not None

    playlist_rows = (
        db.query(PlaylistUser, Playlist)
        .join(Playlist, Playlist.id == PlaylistUser.playlist_id)
        .filter(PlaylistUser.user_id == user.id, PlaylistUser.type == "playlist")
        .order_by(PlaylistUser.created_at.desc())
        .limit(12)
        .all()
    )

    recent_posts = [
        post for post in (
            db.query(SocialPost)
            .filter(SocialPost.user_id == user.id)
            .order_by(SocialPost.created_at.desc())
            .limit(30)
            .all()
        )
        if can_view_profile_audience(db, user.id, current_user.id, post.audience)
    ][:10]
    active_story_cutoff = datetime.utcnow() - timedelta(hours=24)
    profile_story_rows = [
        story for story in (
            db.query(SocialStory)
            .filter(
                SocialStory.user_id == user.id,
                or_(SocialStory.story_type == "reel", SocialStory.created_at >= active_story_cutoff),
            )
            .order_by(SocialStory.created_at.desc())
            .limit(40)
            .all()
        )
        if can_view_profile_audience(db, user.id, current_user.id, story.audience)
    ]
    viewed_story_ids = {
        row.story_id
        for row in db.query(SocialStoryView)
        .filter(SocialStoryView.user_id == current_user.id)
        .all()
    }
    follower_users = (
        db.query(User)
        .join(SocialFollow, SocialFollow.follower_id == User.id)
        .filter(SocialFollow.following_id == user.id)
        .order_by(User.username.asc())
        .limit(50)
        .all()
    )
    following_users = (
        db.query(User)
        .join(SocialFollow, SocialFollow.following_id == User.id)
        .filter(SocialFollow.follower_id == user.id)
        .order_by(User.username.asc())
        .limit(50)
        .all()
    )
    friend_users = (
        db.query(User)
        .join(SocialFriendship, SocialFriendship.friend_id == User.id)
        .filter(SocialFriendship.user_id == user.id)
        .order_by(User.username.asc())
        .limit(50)
        .all()
    )
    owned_song_rows = (
        db.query(SongPurchase, Song)
        .join(Song, Song.track_id == SongPurchase.track_id)
        .filter(SongPurchase.user_id == user.id, SongPurchase.status == "owned")
        .order_by(Song.track_name.asc())
        .limit(50)
        .all()
    )

    serialized_playlists = [
        {
            "id": playlist.id,
            "name": playlist.name,
            "description": playlist.description,
            "cover_image_url": playlist.cover_image_url,
            "created_at": link.created_at.isoformat() if link.created_at else None,
            "track_count": db.query(PlaylistTracks).filter(PlaylistTracks.playlist_id == playlist.id).count(),
        }
        for link, playlist in playlist_rows
    ]
    serialized_posts = [
        {
            "id": post.id,
            "content": post.content,
            "created_at": post.created_at.isoformat(),
            "image_url": post.image_url,
            "media_url": post.media_url or post.image_url,
            "media_type": post.media_type or ("image" if post.image_url else None),
            "audience": post.audience,
        }
        for post in recent_posts
    ]
    serialized_stories = [
        {
            "id": story.id,
            "content": story.content,
            "created_at": story.created_at.isoformat(),
            "image_url": story.image_url,
            "media_url": story.media_url or story.image_url,
            "media_type": story.media_type or ("image" if story.image_url else None),
            "story_type": story.story_type,
            "audience": story.audience,
            "is_owner": story.user_id == current_user.id,
            "is_seen": story.user_id == current_user.id or story.id in viewed_story_ids,
            "author": serialize_public_profile_user(user),
        }
        for story in profile_story_rows
    ]

    return {
        "id": user.id,
        "username": user.username,
        "roles": user.roles,
        "account_type": user.account_type,
        "profile_picture_url": user.profile_picture_url,
        "cover_photo_url": user.cover_photo_url,
        "profile_background_color": user.profile_background_color,
        "is_self": user.id == current_user.id,
        "is_following": is_following,
        "stats": {
            "posts": post_count,
            "followers": follower_count,
            "following": following_count,
            "friends": friend_count,
            "owned_songs": owned_song_count,
        },
        "is_muted": is_muted,
        "is_blocked": is_blocked,
        "has_blocked_you": has_blocked_you,
        "playlists": serialized_playlists,
        "recent_posts": serialized_posts,
        "stories": serialized_stories,
        "profile_lists": {
            "posts": serialized_posts,
            "playlists": serialized_playlists,
            "followers": [serialize_public_profile_user(item) for item in follower_users],
            "following": [serialize_public_profile_user(item) for item in following_users],
            "friends": [serialize_public_profile_user(item) for item in friend_users],
            "owned_songs": [
                {
                    "id": song.track_id,
                    "title": song.track_name,
                    "artist": None,
                    "cover_url": song.track_image_url,
                    "purchased_at": purchase.created_at.isoformat() if purchase.created_at else None,
                }
                for purchase, song in owned_song_rows
            ],
        },
    }

# Change password
@router.put("/me/password")
def change_password(payload: PasswordChange, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    user = db.query(User).filter(User.id == current_user.id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if not verify_password(payload.current_password, user.hashed_password):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    user.hashed_password = hash_password(payload.new_password)
    db.commit()
    log_activity(db, user.id, "change_password", "user", user.id, "Changed account password")
    return {"message": "Password changed successfully"}


def serialize_subscription(db: Session, subscription):
    plan = get_subscription_plan(db, subscription)
    days_remaining = None
    expiring_soon = False
    if subscription.expires_at:
        delta_days = (subscription.expires_at - datetime.utcnow()).days
        days_remaining = max(delta_days, 0)
        expiring_soon = days_remaining <= 7
    return SubscriptionSummary(
        id=subscription.id,
        plan=PlanResponse.model_validate(plan),
        status=subscription.status,
        auto_renew=subscription.auto_renew,
        started_at=subscription.started_at.isoformat() if subscription.started_at else None,
        expires_at=subscription.expires_at.isoformat() if subscription.expires_at else None,
        days_remaining=days_remaining,
        expiring_soon=expiring_soon,
    )


@router.get("/billing", response_model=BillingOverview)
def get_billing_overview(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_default_plans(db)
    subscription = ensure_user_has_subscription(db, current_user)
    pending_subscription = get_pending_subscription(db, current_user.id)
    plan = get_subscription_plan(db, subscription)
    current_user.account_type = plan.code
    db.commit()

    plans = db.query(Plan).order_by(Plan.price_monthly.asc()).all()
    payments = list_recent_payments(db, current_user.id)
    return BillingOverview(
        current_plan=serialize_subscription(db, subscription),
        available_plans=[PlanResponse.model_validate(item) for item in plans],
        recent_payments=[
            PaymentResponse(
                id=item.id,
                subscription_id=item.subscription_id,
                plan_id=item.plan_id,
                amount=item.amount,
                currency=item.currency,
                provider=item.provider,
                status=item.status,
                note=item.note,
                created_at=item.created_at.isoformat() if item.created_at else None,
                updated_at=item.updated_at.isoformat() if item.updated_at else None,
            )
            for item in payments
        ],
        pending_subscription=serialize_subscription(db, pending_subscription) if pending_subscription else None,
    )


@router.post("/billing/subscribe")
def subscribe_plan(payload: SubscribeRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    subscription, plan, payment = upgrade_subscription(db, current_user, payload.plan_code, payload.payment_method or "manual")
    if subscription.status == "active":
        current_user.account_type = plan.code
    else:
        active_subscription = ensure_user_has_subscription(db, current_user)
        current_user.account_type = get_subscription_plan(db, active_subscription).code
    db.commit()
    log_activity(
        db,
        current_user.id,
        "request_plan_change" if payment else "subscribe_plan",
        "plan",
        plan.id,
        (
            f"Awaiting payment confirmation for {plan.name} via {payload.payment_method or 'manual'}"
            if payment else
            f"Subscribed to {plan.name} via {payload.payment_method or 'manual'}"
        ),
    )
    return {
        "message": (
            f"Payment created for {plan.name}. Confirm payment to activate the subscription."
            if payment else
            f"Subscribed to {plan.name}"
        ),
        "account_type": current_user.account_type,
        "payment_id": payment.id if payment else None,
        "subscription_id": subscription.id,
        "subscription_status": subscription.status,
    }


@router.post("/billing/cancel")
def downgrade_to_free(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    subscription = cancel_subscription(db, current_user)
    plan = get_subscription_plan(db, subscription)
    current_user.account_type = plan.code
    db.commit()
    log_activity(db, current_user.id, "downgrade_plan", "plan", plan.id, "Downgraded to Free plan")
    return {
        "message": "Subscription downgraded to Free",
        "account_type": current_user.account_type,
        "subscription_id": subscription.id,
    }


@router.post("/billing/confirm")
def confirm_pending_payment(payload: PaymentActionRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        subscription, payment = confirm_payment(db, current_user, payload.payment_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    plan = get_subscription_plan(db, subscription)
    current_user.account_type = plan.code
    db.commit()
    log_activity(db, current_user.id, "confirm_payment", "payment", payment.id, f"Confirmed payment for {plan.name}")
    return {
        "message": f"Payment confirmed. {plan.name} is now active.",
        "account_type": current_user.account_type,
        "payment_status": payment.status,
        "subscription_status": subscription.status,
    }


@router.post("/billing/fail")
def fail_pending_payment(payload: PaymentActionRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        payment = fail_payment(db, current_user, payload.payment_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    active_subscription = ensure_user_has_subscription(db, current_user)
    current_user.account_type = get_subscription_plan(db, active_subscription).code
    db.commit()
    log_activity(db, current_user.id, "fail_payment", "payment", payment.id, "Marked payment as failed")
    return {
        "message": "Payment marked as failed.",
        "account_type": current_user.account_type,
        "payment_status": payment.status,
    }


@router.post("/billing/renew")
def renew_current_subscription(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    try:
        subscription, payment = renew_subscription(db, current_user)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    plan = get_subscription_plan(db, subscription)
    current_user.account_type = plan.code
    db.commit()
    log_activity(db, current_user.id, "renew_subscription", "payment", payment.id, f"Renewed {plan.name} for 30 days")
    return {
        "message": f"{plan.name} has been renewed for 30 more days.",
        "account_type": current_user.account_type,
        "payment_status": payment.status,
        "expires_at": subscription.expires_at.isoformat() if subscription.expires_at else None,
    }
