from fastapi import APIRouter
from app.api.v1 import auth, stocks, watchlist, insights, portfolio

api_router = APIRouter()

api_router.include_router(auth.router, prefix="/auth", tags=["auth"])
api_router.include_router(stocks.router, prefix="/stocks", tags=["stocks"])
api_router.include_router(watchlist.router, prefix="/watchlist", tags=["watchlist"])
api_router.include_router(insights.router, prefix="/insights", tags=["insights"])
api_router.include_router(portfolio.router, prefix="/portfolio", tags=["portfolio"])

