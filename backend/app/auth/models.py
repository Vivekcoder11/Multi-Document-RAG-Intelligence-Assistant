from pydantic import BaseModel, EmailStr, Field
from typing import Optional, List

class UserRegister(BaseModel):
    email: EmailStr
    password: str = Field(..., min_length=6)
    full_name: str = Field(..., min_length=2)

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    active_workspace_id: str
    created_at: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserResponse

class WorkspaceCreate(BaseModel):
    name: str = Field(..., min_length=2)
    description: Optional[str] = ""

class WorkspaceResponse(BaseModel):
    id: str
    name: str
    description: str
    document_count: int
    created_at: str
