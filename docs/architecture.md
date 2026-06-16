# QuantLens AI - Phase 1 Architecture

This document describes the software architecture and system design for **QuantLens AI (Phase 1: Stock Research Assistant)**.

## System Design

QuantLens AI follows a clean, decoupled client-server architecture:

```
+-----------------------------------+
|          Client (React)           |
|  - Modern Dark Dashboard          |
|  - Recharts for Stock Trends      |
|  - Sentiment Indicators           |
+-----------------+-----------------+
                  |
                  | HTTP REST (JSON) + Bearer Token
                  v
+-----------------+-----------------+
|         Backend (FastAPI)         |
|  - User Auth (JWT tokens)         |
|  - Stock Service (yfinance)       |
|  - Watchlist Manager              |
|  - News Sentiment Engine          |
+--------+-----------------+--------+
         |                 |
         | SQLAlchemy      | Model Pipeline
         v                 v
+--------+--------+  +-----+--------+
| PostgreSQL DB   |  | ML Engine    |
| - Users         |  | - FinBERT    |
| - Watchlists    |  |   Sentiment  |
| - Cache         |  +--------------+
+-----------------+
```

## Core Modules

### 1. Frontend (Vite + React)
- **Vite**: Rapid, modern frontend bundling.
- **Tailwind CSS**: Custom dark styling, leveraging HSL color systems.
- **Recharts**: Responsive charting of historical price trends.
- **Context API**: Handles global user authentication state.

### 2. Backend (FastAPI)
- **FastAPI**: Asynchronous API server with auto-generated OpenAPI documentation.
- **SQLAlchemy & Pydantic**: ORM and data validation layers.
- **yfinance**: Integration library to pull metadata, historical price candles, and active news feeds from Yahoo Finance.

### 3. ML Engine
- **FinBERT**: Pre-trained NLP transformer model (based on BERT) optimized for analyzing financial texts, outputting exact sentiment scores (Positive, Neutral, Negative).

### 4. Database (PostgreSQL)
- Relational storage keeping track of User accounts, JWT session state (passwords hashed via bcrypt), watchlist targets, and analysis caching.
