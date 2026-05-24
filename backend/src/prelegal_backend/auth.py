from __future__ import annotations

import sqlite3
from typing import Annotated

from fastapi import APIRouter, Cookie, Depends, HTTPException, Request, Response, status
from itsdangerous import BadSignature, URLSafeSerializer
from pydantic import BaseModel, EmailStr, Field

from . import users
from .settings import settings


def _serializer() -> URLSafeSerializer:
    return URLSafeSerializer(settings.session_secret, salt="prelegal-session")


def _issue_cookie(response: Response, user_id: int) -> None:
    token = _serializer().dumps({"user_id": user_id})
    response.set_cookie(
        key=settings.session_cookie_name,
        value=token,
        max_age=settings.session_max_age_seconds,
        httponly=True,
        samesite="lax",
        secure=False,  # dev only; flip behind a real proxy
        path="/",
    )


def _clear_cookie(response: Response) -> None:
    response.delete_cookie(key=settings.session_cookie_name, path="/")


def _user_id_from_cookie(token: str | None) -> int | None:
    if not token:
        return None
    try:
        payload = _serializer().loads(token)
    except BadSignature:
        return None
    user_id = payload.get("user_id") if isinstance(payload, dict) else None
    return int(user_id) if isinstance(user_id, int) else None


def get_db(request: Request) -> sqlite3.Connection:
    return request.app.state.db


def current_user(
    db: Annotated[sqlite3.Connection, Depends(get_db)],
    session_token: Annotated[str | None, Cookie(alias=settings.session_cookie_name)] = None,
) -> users.User:
    user_id = _user_id_from_cookie(session_token)
    if user_id is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not signed in")
    user = users.get_by_id(db, user_id)
    if user is None:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Not signed in")
    return user


class SignupRequest(BaseModel):
    email: EmailStr
    name: str = Field(min_length=1, max_length=120)
    password: str = Field(min_length=8, max_length=200)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=200)


class UserOut(BaseModel):
    id: int
    email: str
    name: str

    @classmethod
    def from_user(cls, user: users.User) -> "UserOut":
        return cls(id=user.id, email=user.email, name=user.name)


router = APIRouter(prefix="/api/auth", tags=["auth"])


@router.post(
    "/signup", response_model=UserOut, status_code=status.HTTP_201_CREATED
)
def signup(
    body: SignupRequest,
    response: Response,
    db: Annotated[sqlite3.Connection, Depends(get_db)],
) -> UserOut:
    try:
        user = users.create_with_password(
            db, email=body.email, name=body.name, password=body.password
        )
    except users.EmailAlreadyRegistered:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account already exists for that email.",
        )
    _issue_cookie(response, user.id)
    return UserOut.from_user(user)


@router.post("/login", response_model=UserOut)
def login(
    body: LoginRequest,
    response: Response,
    db: Annotated[sqlite3.Connection, Depends(get_db)],
) -> UserOut:
    user = users.verify_password(db, email=body.email, password=body.password)
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )
    _issue_cookie(response, user.id)
    return UserOut.from_user(user)


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(response: Response) -> None:
    # Mutate the injected response so FastAPI keeps the Set-Cookie header.
    # Returning a fresh Response object would drop it and the client would
    # stay logged in.
    _clear_cookie(response)


@router.get("/me", response_model=UserOut)
def me(user: Annotated[users.User, Depends(current_user)]) -> UserOut:
    return UserOut.from_user(user)
