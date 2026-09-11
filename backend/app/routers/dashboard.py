from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.models.user import User
from app.routers.dependencies import get_current_user
from app.schemas.dashboard import DashboardSummary
from app.services.dashboard_service import get_dashboard

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("", response_model=DashboardSummary)
def dashboard(user: User = Depends(get_current_user), db: Session = Depends(get_db)):
	return get_dashboard(db, user.id)
