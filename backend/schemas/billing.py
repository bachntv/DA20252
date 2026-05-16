from pydantic import BaseModel
from typing import Optional, List


class PlanResponse(BaseModel):
    id: str
    code: str
    name: str
    price_monthly: int
    description: Optional[str]
    max_playlists: int
    emotion_recommendations: bool
    high_quality_audio: bool

    class Config:
        from_attributes = True


class SubscriptionSummary(BaseModel):
    plan: PlanResponse
    status: str
    auto_renew: bool
    started_at: Optional[str]
    expires_at: Optional[str]


class PaymentResponse(BaseModel):
    id: str
    amount: int
    currency: str
    provider: str
    status: str
    note: Optional[str]
    created_at: Optional[str]


class BillingOverview(BaseModel):
    current_plan: SubscriptionSummary
    available_plans: List[PlanResponse]
    recent_payments: List[PaymentResponse]


class SubscribeRequest(BaseModel):
    plan_code: str
    payment_method: Optional[str] = "manual"

