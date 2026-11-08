import os

import httpx
from fastapi import Header, HTTPException


async def get_current_user(authorization: str | None = Header(default=None)) -> dict[str, str]:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="A valid bearer token is required.")

    access_token = authorization.removeprefix("Bearer ").strip()
    if not access_token:
        raise HTTPException(status_code=401, detail="A valid bearer token is required.")

    supabase_url = os.getenv("SUPABASE_URL", "").rstrip("/")
    supabase_anon_key = os.getenv("SUPABASE_ANON_KEY")
    if not supabase_url or not supabase_anon_key:
        raise HTTPException(status_code=503, detail="Supabase authentication is not configured on the server.")

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(
                f"{supabase_url}/auth/v1/user",
                headers={
                    "apikey": supabase_anon_key,
                    "Authorization": f"Bearer {access_token}",
                },
            )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=503, detail="Supabase authentication could not be reached.") from exc

    if response.status_code in {400, 401, 403}:
        raise HTTPException(status_code=401, detail="The bearer token is invalid or expired.")
    if response.status_code != 200:
        raise HTTPException(status_code=503, detail="Supabase authentication could not verify the bearer token.")

    try:
        user = response.json()
    except ValueError as exc:
        raise HTTPException(status_code=503, detail="Supabase returned an invalid authentication response.") from exc

    if not isinstance(user, dict) or not isinstance(user.get("id"), str) or not user["id"]:
        raise HTTPException(status_code=503, detail="Supabase returned an invalid user identity.")

    return {"id": user["id"]}
