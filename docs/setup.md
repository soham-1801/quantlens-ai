# QuantLens AI - Setup Instructions

This document guides you through setting up and running **QuantLens AI (Phase 1)** locally.

## Prerequisites
* Python 3.10+
* Node.js 18+
* PostgreSQL database

---

## 1. Database Setup
1. Create a PostgreSQL database called `quantlens_db`:
   ```sql
   CREATE DATABASE quantlens_db;
   ```
2. Run the SQL schema script located at `database/schema.sql` to initialize the database:
   ```bash
   psql -U your_username -d quantlens_db -f database/schema.sql
   ```
3. (Optional) Insert seed data for testing:
   ```bash
   psql -U your_username -d quantlens_db -f database/seed.sql
   ```

---

## 2. Backend Setup
1. Navigate to the backend directory:
   ```bash
   cd backend
   ```
2. Create and activate a Python virtual environment:
   ```bash
   python -m venv venv
   # On Windows (PowerShell):
   .\venv\Scripts\Activate.ps1
   # On macOS/Linux:
   source venv/bin/activate
   ```
3. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
4. Create a `.env` file (copying from `.env.example`):
   ```env
   DATABASE_URL=postgresql://postgres:postgres@localhost:5432/quantlens_db
   SECRET_KEY=generate_a_random_jwt_secret_key_here_for_production
   ACCESS_TOKEN_EXPIRE_MINUTES=60
   ```
5. Run the FastAPI development server:
   ```bash
   uvicorn app.main:app --reload
   ```
   * Swagger Documentation will be available at: [http://localhost:8000/docs](http://localhost:8000/docs)

---

## 3. Machine Learning Setup
To run the FinBERT sentiment analysis:
1. Navigate to the `ml` folder:
   ```bash
   cd ml
   ```
2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```
3. Run the verification script:
   ```bash
   python sentiment_analyzer.py
   ```
   *Note: On first execution, this script will download the pre-trained FinBERT model weights from Hugging Face (~400MB). Once cached, subsequent runs will load instantly.*

---

## 4. Frontend Setup
1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```
2. Install npm packages:
   ```bash
   npm install
   ```
3. Start the Vite development server:
   ```bash
   npm run dev
   ```
4. Open your browser and navigate to [http://localhost:5173](http://localhost:5173).
