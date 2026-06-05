import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.database import engine, Base
from app.routers import auth, users, bins, submissions, routes

# Create all tables on startup
Base.metadata.create_all(bind=engine)

app = FastAPI(
    title="EcoRoute API",
    description="AI-Optimized Logistics & Tokenized Circular Economy",
    version="1.0.0",
)

# Allow localhost in dev + any Vercel preview URL + your production domain
_extra = os.getenv("ALLOWED_ORIGINS", "")
ALLOWED_ORIGINS = [
    "http://localhost:3000",
    "http://localhost:3001",
] + [o.strip() for o in _extra.split(",") if o.strip()]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_origin_regex=r"https://.*\.vercel\.app",   # all Vercel preview URLs
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router)
app.include_router(users.router)
app.include_router(bins.router)
app.include_router(submissions.router)
app.include_router(routes.router)


@app.get("/health")
def health():
    return {"status": "ok", "service": "EcoRoute API"}


@app.get("/")
def root():
    return {"message": "EcoRoute API — visit /docs for interactive API documentation"}
