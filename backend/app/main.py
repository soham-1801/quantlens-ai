from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from app.core.config import settings
from app.core.database import engine, Base
from app.core.rate_limit import limiter
from app.api.router import api_router

# Import models to register them with Base metadata
from app.models.user import User
from app.models.watchlist import Watchlist
from app.models.sentiment_cache import SentimentCache


# Auto-create tables if they don't exist (primarily for SQLite development)
if settings.DATABASE_URL.startswith("sqlite"):
    Base.metadata.create_all(bind=engine)

from fastapi.openapi.utils import get_openapi

app = FastAPI(
    title=settings.PROJECT_NAME,
    description="AI-powered Stock Market Research Assistant - Foundation Setup",
    version="1.0.0",
    openapi_url=f"{settings.API_V1_STR}/openapi.json"
)

def custom_openapi():
    if app.openapi_schema:
        return app.openapi_schema
    openapi_schema = get_openapi(
        title=app.title,
        version=app.version,
        description=app.description,
        routes=app.routes,
    )
    if "components" not in openapi_schema:
        openapi_schema["components"] = {}
    if "securitySchemes" not in openapi_schema["components"]:
        openapi_schema["components"]["securitySchemes"] = {}
        
    openapi_schema["components"]["securitySchemes"]["BearerAuth"] = {
        "type": "http",
        "scheme": "bearer",
        "bearerFormat": "JWT",
        "description": "Enter your JWT Bearer token directly."
    }
    
    # Add BearerAuth as an alternative to existing security requirements for all routes
    for path_data in openapi_schema.get("paths", {}).values():
        for method_data in path_data.values():
            security = method_data.get("security")
            if security is not None:
                # If there are any security requirements, append BearerAuth as an alternative
                if not any("BearerAuth" in sec for sec in security):
                    security.append({"BearerAuth": []})
                    method_data["security"] = security

    app.openapi_schema = openapi_schema
    return app.openapi_schema

app.openapi = custom_openapi

app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Security headers middleware
class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["Referrer-Policy"] = "same-origin"
        response.headers["Permissions-Policy"] = "camera=(), microphone=(), geolocation=()"
        return response

app.add_middleware(SecurityHeadersMiddleware)

# CORS configuration — read from environment variable
origins = [
    origin.strip()
    for origin in settings.BACKEND_CORS_ORIGINS.split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Mount APIRouter
app.include_router(api_router, prefix=settings.API_V1_STR)

@app.get("/")
def read_root():
    return {
        "message": f"Welcome to {settings.PROJECT_NAME} API!",
        "version": "1.0.0",
        "docs_url": "/docs",
        "phase": "Foundation",
        "status": "online"
    }
