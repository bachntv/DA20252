from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import Optional
from jose import jwt, JWTError
from datetime import datetime, timedelta
from pydantic import BaseModel

from models.base import SessionLocal
from models.user import User
from models.plan import Plan
from schemas.user import UserUpdate
from schemas.billing import BillingOverview, PlanResponse, SubscriptionSummary, PaymentResponse, SubscribeRequest
from .auth_routes import get_current_user
from utils.password import verify_password, hash_password
from utils.activity import log_activity
from utils.billing import (
    ensure_user_has_subscription,
    get_subscription_plan,
    ensure_default_plans,
    upgrade_subscription,
    cancel_subscription,
    list_recent_payments,
)

router = APIRouter()

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
    return SubscriptionSummary(
        plan=PlanResponse.model_validate(plan),
        status=subscription.status,
        auto_renew=subscription.auto_renew,
        started_at=subscription.started_at.isoformat() if subscription.started_at else None,
        expires_at=subscription.expires_at.isoformat() if subscription.expires_at else None,
    )


@router.get("/billing", response_model=BillingOverview)
def get_billing_overview(db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    ensure_default_plans(db)
    subscription = ensure_user_has_subscription(db, current_user)
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
                amount=item.amount,
                currency=item.currency,
                provider=item.provider,
                status=item.status,
                note=item.note,
                created_at=item.created_at.isoformat() if item.created_at else None,
            )
            for item in payments
        ],
    )


@router.post("/billing/subscribe")
def subscribe_plan(payload: SubscribeRequest, db: Session = Depends(get_db), current_user: User = Depends(get_current_user)):
    subscription, plan, payment = upgrade_subscription(db, current_user, payload.plan_code, payload.payment_method or "manual")
    current_user.account_type = plan.code
    db.commit()
    log_activity(
        db,
        current_user.id,
        "subscribe_plan",
        "plan",
        plan.id,
        f"Subscribed to {plan.name} via {payload.payment_method or 'manual'}",
    )
    return {
        "message": f"Subscribed to {plan.name}",
        "account_type": current_user.account_type,
        "payment_id": payment.id if payment else None,
        "subscription_id": subscription.id,
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
