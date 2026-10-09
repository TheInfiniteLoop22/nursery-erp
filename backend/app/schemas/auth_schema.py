from pydantic import BaseModel

#this is only for testing
class RegisterRequest(BaseModel):
    user_id: str
    user_username: str
    user_password: str
    role: str  # admin | employee

class RegisterRequest(BaseModel):
    user_username: str
    user_password: str
    role: str  # admin | employee | nursery


class LoginRequest(BaseModel):
    user_username: str
    user_password: str

class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    user_id: str
