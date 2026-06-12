from datetime import datetime
import uuid

from sqlalchemy import Boolean, Column, DateTime, ForeignKey, String, Text, UniqueConstraint

from models.base import Base


def generate_uuid():
    return str(uuid.uuid4())


class SocialPost(Base):
    __tablename__ = "social_posts"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    content = Column(Text, nullable=False)
    track_id = Column(String, nullable=True, index=True)
    image_url = Column(String, nullable=True)
    media_url = Column(String, nullable=True)
    media_type = Column(String, nullable=False, default="image")
    shared_post_id = Column(String, nullable=True, index=True)
    audience = Column(String, nullable=False, default="public", index=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)


class SocialLike(Base):
    __tablename__ = "social_likes"
    __table_args__ = (UniqueConstraint("post_id", "user_id", name="uq_social_like_post_user"),)

    id = Column(String, primary_key=True, default=generate_uuid)
    post_id = Column(String, ForeignKey("social_posts.id"), nullable=False, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)


class SocialComment(Base):
    __tablename__ = "social_comments"

    id = Column(String, primary_key=True, default=generate_uuid)
    post_id = Column(String, ForeignKey("social_posts.id"), nullable=False, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)


class SocialFollow(Base):
    __tablename__ = "social_follows"
    __table_args__ = (UniqueConstraint("follower_id", "following_id", name="uq_social_follow_pair"),)

    id = Column(String, primary_key=True, default=generate_uuid)
    follower_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    following_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)


class SocialShare(Base):
    __tablename__ = "social_shares"

    id = Column(String, primary_key=True, default=generate_uuid)
    post_id = Column(String, ForeignKey("social_posts.id"), nullable=False, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)


class SocialFriendRequest(Base):
    __tablename__ = "social_friend_requests"
    __table_args__ = (UniqueConstraint("requester_id", "addressee_id", name="uq_social_friend_request_pair"),)

    id = Column(String, primary_key=True, default=generate_uuid)
    requester_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    addressee_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    status = Column(String, nullable=False, default="pending", index=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)


class SocialFriendship(Base):
    __tablename__ = "social_friendships"
    __table_args__ = (UniqueConstraint("user_id", "friend_id", name="uq_social_friendship_pair"),)

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    friend_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)


class SocialMessage(Base):
    __tablename__ = "social_messages"

    id = Column(String, primary_key=True, default=generate_uuid)
    sender_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    recipient_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)
    read_at = Column(DateTime, nullable=True)
    deleted_by_sender = Column(Boolean, nullable=False, default=False)
    deleted_by_recipient = Column(Boolean, nullable=False, default=False)


class SocialBlock(Base):
    __tablename__ = "social_blocks"
    __table_args__ = (UniqueConstraint("blocker_id", "blocked_id", name="uq_social_block_pair"),)

    id = Column(String, primary_key=True, default=generate_uuid)
    blocker_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    blocked_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)


class SocialMute(Base):
    __tablename__ = "social_mutes"
    __table_args__ = (UniqueConstraint("muter_id", "muted_id", name="uq_social_mute_pair"),)

    id = Column(String, primary_key=True, default=generate_uuid)
    muter_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    muted_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)


class SocialStory(Base):
    __tablename__ = "social_stories"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    content = Column(Text, nullable=False, default="")
    image_url = Column(String, nullable=True)
    media_url = Column(String, nullable=True)
    media_type = Column(String, nullable=False, default="image")
    track_id = Column(String, nullable=True, index=True)
    story_type = Column(String, nullable=False, default="story", index=True)
    audience = Column(String, nullable=False, default="public", index=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)


class SocialStoryView(Base):
    __tablename__ = "social_story_views"
    __table_args__ = (UniqueConstraint("story_id", "user_id", name="uq_social_story_view_story_user"),)

    id = Column(String, primary_key=True, default=generate_uuid)
    story_id = Column(String, ForeignKey("social_stories.id"), nullable=False, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)


class SocialStoryLike(Base):
    __tablename__ = "social_story_likes"
    __table_args__ = (UniqueConstraint("story_id", "user_id", name="uq_social_story_like_story_user"),)

    id = Column(String, primary_key=True, default=generate_uuid)
    story_id = Column(String, ForeignKey("social_stories.id"), nullable=False, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)


class SocialStoryComment(Base):
    __tablename__ = "social_story_comments"

    id = Column(String, primary_key=True, default=generate_uuid)
    story_id = Column(String, ForeignKey("social_stories.id"), nullable=False, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    parent_comment_id = Column(String, ForeignKey("social_story_comments.id"), nullable=True, index=True)
    content = Column(Text, nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)


class SocialStoryCommentLike(Base):
    __tablename__ = "social_story_comment_likes"
    __table_args__ = (
        UniqueConstraint("comment_id", "user_id", name="uq_story_comment_like_comment_user"),
    )

    id = Column(String, primary_key=True, default=generate_uuid)
    comment_id = Column(String, ForeignKey("social_story_comments.id"), nullable=False, index=True)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
