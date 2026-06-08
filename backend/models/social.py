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
    shared_post_id = Column(String, nullable=True, index=True)
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


class SocialStory(Base):
    __tablename__ = "social_stories"

    id = Column(String, primary_key=True, default=generate_uuid)
    user_id = Column(String, ForeignKey("users.id"), nullable=False, index=True)
    content = Column(Text, nullable=False, default="")
    image_url = Column(String, nullable=True)
    track_id = Column(String, nullable=True, index=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow, index=True)
