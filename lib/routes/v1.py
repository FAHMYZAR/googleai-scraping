import base64
import json
import os
import tempfile
from pathlib import Path
import time
import uuid
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form
from pydantic import BaseModel

from lib.core.auth import require_api_key
from lib.core.config import AppConfig
from lib.services.gai_provider import GaiProviderService


router = APIRouter(prefix="/v1", tags=["gai-v1"])


class ChatMessage(BaseModel):
    role: str
    content: Any


class ChatCompletionRequest(BaseModel):
    model: str
    messages: list[ChatMessage]
    stream: bool = False


def extract_text_content(content: Any) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        texts = []
        for item in content:
            if isinstance(item, dict) and item.get("type") == "text":
                texts.append(item.get("text", ""))
        return "\n".join([t for t in texts if t])
    return ""


def extract_image_content(content: Any) -> str | None:
    if not isinstance(content, list):
        return None
    for item in content:
        if isinstance(item, dict) and item.get("type") == "image_url":
            url = item.get("image_url", {}).get("url", "") if isinstance(item.get("image_url"), dict) else ""
            if url.startswith("data:image"):
                return url
    return None


def build_prompt(messages: list[ChatMessage]) -> tuple[str, str | None]:
    system_parts = []
    user_parts = []
    image_url = None

    for message in messages:
        text = extract_text_content(message.content)
        file_img = extract_image_content(message.content)
        if file_img:
            image_url = file_img
        if not text:
            continue
        if message.role in {"system", "developer"}:
            system_parts.append(text)
        elif message.role == "user":
            user_parts.append(text)

    prompt_parts = []
    if system_parts:
        prompt_parts.append("Instruksi sistem:\n" + "\n".join(system_parts))
    if user_parts:
        prompt_parts.append("Permintaan user:\n" + "\n".join(user_parts))

    return "\n\n".join(prompt_parts), image_url


def append_sources(content: str, sources: list) -> str:
    if not sources:
        return content
    lines = [content.strip(), "", "Sumber:"]
    for idx, source in enumerate(sources, 1):
        name = source.get("name") or source.get("title") or f"Source {idx}"
        url = source.get("url") or source.get("link") or ""
        lines.append(f"{idx}. {name}: {url}".strip())
    return "\n".join(lines).strip()


def save_base64_image(data_url: str) -> str | None:
    if not data_url or not data_url.startswith("data:image"):
        return None
    try:
        header, encoded = data_url.split(",", 1)
        img_data = base64.b64decode(encoded)
        suffix = ".png"
        if "jpeg" in header or "jpg" in header:
            suffix = ".jpg"
        tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix, dir=AppConfig.APP_DIR)
        tmp.write(img_data)
        tmp_path = tmp.name
        tmp.close()
        return tmp_path
    except Exception:
        return None


@router.get("/models")
def list_models(token: str = Depends(require_api_key)):
    """Mendapatkan daftar model yang didukung provider Google AI (OpenAI format)."""
    return {
        "object": "list",
        "data": [
            {
                "id": AppConfig.MODEL_ID,
                "object": "model",
                "created": int(time.time()),
                "owned_by": AppConfig.APP_NAME,
            }
        ],
    }


@router.post("/chat/completions")
def chat_completions(payload: ChatCompletionRequest, token: str = Depends(require_api_key)):
    """Kirim chat prompt ke Google AI Mode (OpenAI format, mendukung Base64 Image upload)."""
    if not payload.messages:
        raise HTTPException(status_code=400, detail="messages kosong")

    prompt, image_data_url = build_prompt(payload.messages)
    if not prompt.strip() and not image_data_url:
        raise HTTPException(status_code=400, detail="messages tidak mengandung text/image")

    file_path = None
    try:
        file_path = save_base64_image(image_data_url) if image_data_url else None
        service = GaiProviderService()
        result = service.chat(prompt, file_path)
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error))
    finally:
        if file_path and os.path.exists(file_path):
            os.unlink(file_path)

    if not result.get("ok"):
        raise HTTPException(status_code=502, detail=result.get("error") or "GAI provider error")

    content = result.get("markdown") or result.get("text") or ""
    content = append_sources(content, result.get("sources") or [])
    model_name = payload.model or AppConfig.MODEL_ID

    return {
        "id": f"chatcmpl-{uuid.uuid4().hex}",
        "object": "chat.completion",
        "created": int(time.time()),
        "model": model_name,
        "choices": [
            {
                "index": 0,
                "message": {
                    "role": "assistant",
                    "content": content,
                },
                "finish_reason": "stop",
            }
        ],
        "usage": {
            "prompt_tokens": 0,
            "completion_tokens": 0,
            "total_tokens": 0,
        },
    }


@router.post("/chat/file")
async def chat_with_file(
    file: UploadFile = File(...),
    message: str = Form(""),
    token: str = Depends(require_api_key),
):
    """Kirim pertanyaan ke Google AI dengan input multipart Upload File (gambar/pdf)."""
    suffix = Path(file.filename).suffix if file.filename else ".png"
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=suffix, dir=AppConfig.APP_DIR)
    content = await file.read()
    tmp.write(content)
    file_path = tmp.name
    tmp.close()

    try:
        service = GaiProviderService()
        result = service.chat(message or "", file_path)
    except Exception as error:
        raise HTTPException(status_code=500, detail=str(error))
    finally:
        if os.path.exists(file_path):
            os.unlink(file_path)

    if not result.get("ok"):
        raise HTTPException(status_code=502, detail=result.get("error") or "GAI provider error")

    answer = result.get("markdown") or result.get("text") or ""
    answer = append_sources(answer, result.get("sources") or [])

    return {"success": True, "content": answer}
