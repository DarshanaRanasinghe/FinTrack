from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import uvicorn

from config.database import init_database, close_connection
from routes.auth_routes import router as auth_router
from routes.transaction_routes import router as transaction_router
from routes.goal_routes import router as goal_router
from routes.report_routes import router as report_router

@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup
    await init_database()
    yield
    # Shutdown
    await close_connection()

app = FastAPI(
    title="Finance API",
    description="Personal Finance Management API",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(auth_router)
app.include_router(transaction_router)
app.include_router(goal_router)
app.include_router(report_router)

@app.get("/")
async def root():
    return {
        "success": True,
        "message": "Finance API Server",
        "endpoints": {
            "health": "/health",
            "auth": "/auth",
            "transactions": "/transactions",
            "goals": "/goals",
            "reports": "/reports"
        }
    }

@app.get("/health")
async def health_check():
    return {
        "success": True,
        "message": "Finance API is running",
        "timestamp": "2024-01-01T00:00:00.000Z"  # You might want to use datetime here
    }

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )