import pytest
from app.auth.security import get_password_hash, verify_password, create_access_token
import jwt
from app.config import settings

def test_password_hashing():
    raw_pw = "ProductionSecurePass99!"
    hashed = get_password_hash(raw_pw)
    assert hashed != raw_pw
    assert verify_password(raw_pw, hashed) is True
    assert verify_password("wrongpassword", hashed) is False

def test_jwt_token_flow():
    user_payload = {"sub": "user_id_999", "email": "test@intelligence.ai"}
    token = create_access_token(user_payload)
    assert isinstance(token, str)
    
    decoded = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
    assert decoded["sub"] == "user_id_999"
    assert decoded["email"] == "test@intelligence.ai"
    assert "exp" in decoded
