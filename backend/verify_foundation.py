import sys
import os
from datetime import timedelta

# Add backend root to path
sys.path.insert(0, os.path.abspath(os.path.dirname(__file__)))

try:
    from app.core.config import settings
    from app.core.database import SessionLocal, engine, Base
    from app.core.security import verify_password, get_password_hash, create_access_token
    from app.models.user import User
    from app.schemas.user import UserCreate
    print("SUCCESS: Core imports resolved correctly.")
except ImportError as e:
    print(f"FAILED: Import check failed: {e}")
    sys.exit(1)

def test_database_connectivity():
    print("\n--- 1. Testing Database Connectivity & Base Metadata ---")
    try:
        # Verify engine connection and create tables
        Base.metadata.create_all(bind=engine)
        print("SUCCESS: Base tables created successfully in active database.")
        print(f"Active database URL: {settings.DATABASE_URL}")
        
        # Test SQLite vs PostgreSQL compatibility
        if settings.DATABASE_URL.startswith("sqlite"):
            print("INFO: SQLite engine confirmed.")
        elif settings.DATABASE_URL.startswith("postgresql"):
            print("INFO: PostgreSQL engine confirmed.")
            
        db = SessionLocal()
        # Ping database with a simple query
        db.execute(Base.metadata.tables['users'].select())
        db.close()
        print("SUCCESS: Database session ping returned successfully.")
    except Exception as e:
        print(f"FAILED: Database test failed: {e}")
        return False
    return True

def test_password_hashing_and_auth():
    print("\n--- 2. Testing Password Encryption & JWT Flow ---")
    try:
        # Test Bcrypt
        raw_password = "SecurePassword123"
        hashed = get_password_hash(raw_password)
        print(f"INFO: Generated hash: {hashed[:25]}...")
        assert verify_password(raw_password, hashed) is True
        assert verify_password("wrong_password", hashed) is False
        print("SUCCESS: Bcrypt password hashing & verification verified.")

        # Test JWT
        subject = 42
        token = create_access_token(subject, expires_delta=timedelta(minutes=10))
        print(f"INFO: JWT Token generated: {token[:20]}...")
        
        from jose import jwt
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[settings.ALGORITHM])
        decoded_sub = payload.get("sub")
        assert int(decoded_sub) == subject
        print("SUCCESS: JWT generation & signature verification verified.")
    except Exception as e:
        print(f"FAILED: Security unit tests failed: {e}")
        return False
    return True

def test_user_registration_model():
    print("\n--- 3. Testing User Model CRUD operations ---")
    db = SessionLocal()
    try:
        test_email = "tester@quantlens.ai"
        
        # Cleanup if tester already exists
        existing = db.query(User).filter(User.email == test_email).first()
        if existing:
            db.delete(existing)
            db.commit()
            
        # Create User
        hashed_pwd = get_password_hash("password123")
        new_user = User(
            email=test_email,
            hashed_password=hashed_pwd,
            full_name="Testing Engineer",
            is_active=True
        )
        db.add(new_user)
        db.commit()
        db.refresh(new_user)
        
        print(f"SUCCESS: User registered in DB. ID: {new_user.id}, Created At: {new_user.created_at}")
        assert new_user.email == test_email
        
        # Read back user
        retrieved = db.query(User).filter(User.id == new_user.id).first()
        assert retrieved is not None
        assert retrieved.full_name == "Testing Engineer"
        print("SUCCESS: User profile query readback verified.")
        
        # Cleanup
        db.delete(retrieved)
        db.commit()
        print("SUCCESS: Database transactions rolled back and cleaned up.")
    except Exception as e:
        print(f"FAILED: User registration model test failed: {e}")
        db.rollback()
        db.close()
        return False
    db.close()
    return True

def test_alembic_setup():
    print("\n--- 4. Checking Alembic Config & Script Templates ---")
    try:
        ini_path = os.path.join(os.path.dirname(__file__), "alembic.ini")
        env_path = os.path.join(os.path.dirname(__file__), "alembic", "env.py")
        script_path = os.path.join(os.path.dirname(__file__), "alembic", "script.py.mako")
        
        assert os.path.exists(ini_path) is True
        assert os.path.exists(env_path) is True
        assert os.path.exists(script_path) is True
        
        # Try compiling env.py to check for syntax errors
        import py_compile
        py_compile.compile(env_path)
        print("SUCCESS: Alembic configuration and migration env.py files verified.")
    except Exception as e:
        print(f"FAILED: Alembic test failed: {e}")
        return False
    return True

if __name__ == "__main__":
    print("====================================================")
    print("          QUANTLENS AI FOUNDATION VERIFIER          ")
    print("====================================================")
    
    db_ok = test_database_connectivity()
    auth_ok = test_password_hashing_and_auth()
    crud_ok = test_user_registration_model()
    alembic_ok = test_alembic_setup()
    
    print("\n====================================================")
    if db_ok and auth_ok and crud_ok and alembic_ok:
        print("         VERIFICATION STATUS: ALL TESTS PASSED       ")
    else:
        print("         VERIFICATION STATUS: FAILURES DETECTED      ")
    print("====================================================")
    
    if not (db_ok and auth_ok and crud_ok and alembic_ok):
        sys.exit(1)
