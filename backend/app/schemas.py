from datetime import datetime

from pydantic import BaseModel, Field


class RegisterIn(BaseModel):
    full_name: str = Field(min_length=3, max_length=120)
    email: str = Field(max_length=254)
    password: str = Field(min_length=8, max_length=128)
    university_id: str | None = None
    username: str | None = None
    faculty: str | None = Field(default=None, max_length=120)
    major: str | None = Field(default=None, max_length=120)


class LoginIn(BaseModel):
    identifier: str = Field(min_length=3, max_length=254)
    password: str = Field(min_length=1, max_length=128)


class ProfileUpdate(BaseModel):
    full_name: str = Field(min_length=3, max_length=120)
    university_id: str | None = None


class UserOut(BaseModel):
    id: str
    full_name: str
    email: str | None
    username: str | None
    university_id: str | None
    role: str
    faculty: str | None
    major: str | None
    created_at: datetime


class TokenOut(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user: UserOut


class ContactIn(BaseModel):
    name: str = Field(min_length=2, max_length=120)
    email: str = Field(max_length=254)
    subject: str = Field(min_length=3, max_length=200)
    message: str = Field(min_length=10, max_length=5000)
