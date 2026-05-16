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
