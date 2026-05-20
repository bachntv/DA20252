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
