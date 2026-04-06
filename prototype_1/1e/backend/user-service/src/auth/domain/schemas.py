from datetime import datetime

from pydantic import BaseModel, ConfigDict, Field


class RegisterRequest(BaseModel):
    first_name: str = Field(..., min_length=2, max_length=80, alias="firstName")
    last_name: str = Field(..., min_length=2, max_length=80, alias="lastName")
    email: str = Field(..., min_length=5, max_length=255)
    password: str = Field(..., min_length=6, max_length=128)

    model_config = ConfigDict(populate_by_name=True)


class LoginRequest(BaseModel):
    email: str = Field(..., min_length=5, max_length=255)
    password: str = Field(..., min_length=6, max_length=128)


class RefreshRequest(BaseModel):
    refresh_token: str = Field(..., min_length=10, alias="refreshToken")

    model_config = ConfigDict(populate_by_name=True)


class AuthUserResponse(BaseModel):
    id: str
    email: str
    first_name: str = Field(..., alias="firstName")
    last_name: str = Field(..., alias="lastName")
    created_at: datetime = Field(..., alias="createdAt")

    model_config = ConfigDict(populate_by_name=True)


class AuthResponse(BaseModel):
    user: AuthUserResponse
    access_token: str = Field(..., alias="accessToken")
    refresh_token: str = Field(..., alias="refreshToken")
    token_type: str = Field(default="bearer", alias="tokenType")

    model_config = ConfigDict(populate_by_name=True)


class RefreshResponse(BaseModel):
    access_token: str = Field(..., alias="accessToken")
    refresh_token: str = Field(..., alias="refreshToken")
    token_type: str = Field(default="bearer", alias="tokenType")

    model_config = ConfigDict(populate_by_name=True)
