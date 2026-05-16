from datetime import datetime, timedelta
from sqlalchemy.orm import Session

from models.plan import Plan
from models.subscription import Subscription
from models.payment import Payment
from models.user import User


DEFAULT_PLANS = [
    {
        "code": "free",
        "name": "Free",
        "price_monthly": 0,
        "description": "Goi co ban de nghe nhac va quan ly playlist ca nhan.",
        "max_playlists": 3,
        "emotion_recommendations": False,
        "high_quality_audio": False,
    },
    {
        "code": "premium",
        "name": "Premium",
        "price_monthly": 99000,
        "description": "Mo khoa goi y theo cam xuc, nhieu playlist hon va chat luong nghe tot hon.",
        "max_playlists": 50,
        "emotion_recommendations": True,
        "high_quality_audio": True,
    },
]


def ensure_default_plans(db: Session):
    for plan_data in DEFAULT_PLANS:
        existing = db.query(Plan).filter(Plan.code == plan_data["code"]).first()
        if not existing:
            db.add(Plan(**plan_data))
    db.commit()


def get_plan_by_code(db: Session, code: str) -> Plan:
    plan = db.query(Plan).filter(Plan.code == code).first()
    if not plan:
        raise ValueError(f"Plan not found: {code}")
    return plan


def get_active_subscription(db: Session, user_id: str) -> Subscription | None:
    return (
        db.query(Subscription)
        .filter(Subscription.user_id == user_id, Subscription.status == "active")
        .order_by(Subscription.started_at.desc())
        .first()
    )


def ensure_user_has_subscription(db: Session, user: User) -> Subscription:
    ensure_default_plans(db)
    existing = get_active_subscription(db, user.id)
    if existing:
        return existing

    free_plan = get_plan_by_code(db, "free")
    subscription = Subscription(
        user_id=user.id,
        plan_id=free_plan.id,
        status="active",
        auto_renew=True,
        started_at=datetime.utcnow(),
        expires_at=None,
    )
    db.add(subscription)
    db.commit()
    db.refresh(subscription)
    return subscription


def get_subscription_plan(db: Session, subscription: Subscription) -> Plan:
    plan = db.query(Plan).filter(Plan.id == subscription.plan_id).first()
    if not plan:
        raise ValueError("Subscription plan not found")
    return plan


def upgrade_subscription(db: Session, user: User, target_plan_code: str, payment_method: str = "manual"):
    ensure_default_plans(db)
    target_plan = get_plan_by_code(db, target_plan_code)
    current = ensure_user_has_subscription(db, user)

    if current.plan_id == target_plan.id:
        return current, target_plan, None

    current.status = "cancelled"
    current.auto_renew = False
    current.updated_at = datetime.utcnow()

    new_subscription = Subscription(
        user_id=user.id,
        plan_id=target_plan.id,
        status="active",
        auto_renew=True,
        started_at=datetime.utcnow(),
        expires_at=datetime.utcnow() + timedelta(days=30) if target_plan.price_monthly > 0 else None,
    )
    db.add(new_subscription)
    db.flush()

    payment = Payment(
        user_id=user.id,
        subscription_id=new_subscription.id,
        plan_id=target_plan.id,
        amount=target_plan.price_monthly,
        currency="VND",
        provider=payment_method or "manual",
        status="paid",
        note=f"Subscribed to {target_plan.name}",
    )
    db.add(payment)
    db.commit()
    db.refresh(new_subscription)
    db.refresh(payment)
    return new_subscription, target_plan, payment


def cancel_subscription(db: Session, user: User):
    current = ensure_user_has_subscription(db, user)
    current_plan = get_subscription_plan(db, current)
    if current_plan.code == "free":
        return current

    current.status = "cancelled"
    current.auto_renew = False
    current.updated_at = datetime.utcnow()

    free_plan = get_plan_by_code(db, "free")
    replacement = Subscription(
        user_id=user.id,
        plan_id=free_plan.id,
        status="active",
        auto_renew=True,
        started_at=datetime.utcnow(),
        expires_at=None,
    )
    db.add(replacement)
    db.commit()
    db.refresh(replacement)
    return replacement


def list_recent_payments(db: Session, user_id: str, limit: int = 10):
    return (
        db.query(Payment)
        .filter(Payment.user_id == user_id)
        .order_by(Payment.created_at.desc())
        .limit(limit)
        .all()
    )
