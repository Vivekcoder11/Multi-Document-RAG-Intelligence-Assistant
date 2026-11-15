import uuid
from datetime import datetime, timezone
from fastapi import APIRouter, Depends, HTTPException, status
from typing import List, Dict, Any
from app.auth.models import (
    UserRegister, UserLogin, UserResponse, TokenResponse,
    WorkspaceCreate, WorkspaceResponse
)
from app.auth.security import (
    verify_password, get_password_hash, create_access_token, get_current_user
)
from app.database import db_manager

router = APIRouter(prefix="/auth", tags=["Authentication & Workspaces"])

@router.post("/register", response_model=TokenResponse)
async def register(user_in: UserRegister):
    existing = await db_manager.find_user_by_email(user_in.email)
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="User with this email already exists"
        )
    
    user_id = str(uuid.uuid4())
    default_ws_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    
    # Create Default Workspace
    ws_data = {
        "id": default_ws_id,
        "user_id": user_id,
        "name": "Default Workspace",
        "description": "Primary workspace for your documents and intelligent chat",
        "document_count": 0,
        "created_at": now
    }
    await db_manager.create_workspace(ws_data)
    
    # Create User
    user_data = {
        "id": user_id,
        "email": user_in.email.lower().strip(),
        "hashed_password": get_password_hash(user_in.password),
        "full_name": user_in.full_name.strip(),
        "role": "member",
        "active_workspace_id": default_ws_id,
        "created_at": now
    }
    await db_manager.create_user(user_data)
    
    access_token = create_access_token(data={"sub": user_id, "email": user_data["email"]})
    user_resp = UserResponse(
        id=user_id,
        email=user_data["email"],
        full_name=user_data["full_name"],
        role=user_data["role"],
        active_workspace_id=default_ws_id,
        created_at=now
    )
    return TokenResponse(access_token=access_token, user=user_resp)

@router.post("/login", response_model=TokenResponse)
async def login(credentials: UserLogin):
    user = await db_manager.find_user_by_email(credentials.email)
    if not user or not verify_password(credentials.password, user.get("hashed_password", "")):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    access_token = create_access_token(data={"sub": user["id"], "email": user["email"]})
    user_resp = UserResponse(
        id=user["id"],
        email=user["email"],
        full_name=user["full_name"],
        role=user.get("role", "member"),
        active_workspace_id=user.get("active_workspace_id", ""),
        created_at=user.get("created_at", "")
    )
    return TokenResponse(access_token=access_token, user=user_resp)

@router.get("/me", response_model=UserResponse)
async def get_current_user_profile(current_user: Dict[str, Any] = Depends(get_current_user)):
    return UserResponse(
        id=current_user["id"],
        email=current_user["email"],
        full_name=current_user["full_name"],
        role=current_user.get("role", "member"),
        active_workspace_id=current_user.get("active_workspace_id", ""),
        created_at=current_user.get("created_at", "")
    )

@router.get("/workspaces", response_model=List[WorkspaceResponse])
async def list_workspaces(current_user: Dict[str, Any] = Depends(get_current_user)):
    workspaces = await db_manager.get_workspaces(current_user["id"])
    
    # Update document counts
    res = []
    for ws in workspaces:
        docs = await db_manager.get_documents(ws["id"])
        res.append(WorkspaceResponse(
            id=ws["id"],
            name=ws["name"],
            description=ws.get("description", ""),
            document_count=len(docs),
            created_at=ws.get("created_at", "")
        ))
    return res

@router.post("/workspaces", response_model=WorkspaceResponse)
async def create_workspace_endpoint(
    ws_in: WorkspaceCreate,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    ws_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc).isoformat()
    ws_data = {
        "id": ws_id,
        "user_id": current_user["id"],
        "name": ws_in.name.strip(),
        "description": ws_in.description.strip(),
        "document_count": 0,
        "created_at": now
    }
    created = await db_manager.create_workspace(ws_data)
    return WorkspaceResponse(
        id=created["id"],
        name=created["name"],
        description=created.get("description", ""),
        document_count=0,
        created_at=created["created_at"]
    )

@router.post("/workspaces/{workspace_id}/switch", response_model=UserResponse)
async def switch_workspace(
    workspace_id: str,
    current_user: Dict[str, Any] = Depends(get_current_user)
):
    ws = await db_manager.get_workspace(workspace_id)
    if not ws or ws.get("user_id") != current_user["id"]:
        raise HTTPException(status_code=404, detail="Workspace not found")
        
    # Update user's active workspace
    current_user["active_workspace_id"] = workspace_id
    if db_manager.is_mongo:
        await db_manager.db.users.update_one({"id": current_user["id"]}, {"$set": {"active_workspace_id": workspace_id}})
    else:
        await db_manager._save_local_store()
        
    return UserResponse(
        id=current_user["id"],
        email=current_user["email"],
        full_name=current_user["full_name"],
        role=current_user.get("role", "member"),
        active_workspace_id=workspace_id,
        created_at=current_user.get("created_at", "")
    )
