from typing import Dict, Any, Optional
from fastapi import APIRouter, Depends, Query
from app.auth.security import get_current_user
from app.database import db_manager

router = APIRouter(prefix="/analytics", tags=["Analytics & Document Intelligence"])

@router.get("/dashboard")
async def get_dashboard_analytics(
    workspace_id: Optional[str] = Query(None),
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    active_ws = workspace_id or current_user.get("active_workspace_id")
    stats = await db_manager.get_analytics(active_ws)
    return stats
