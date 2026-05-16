# Music Streaming Platform

Full-stack music streaming app

## Quick Start

### 1. Clone Repository
```bash
git clone https://github.com/bachntv/do-an.git
cd do-an
```

### 2. Setup Environment
Create `backend/.env`:
```ini
POSTGRES_USER=postgres
POSTGRES_PASSWORD=postgres
POSTGRES_HOST=localhost
POSTGRES_PORT=5432
POSTGRES_DATABASE=music_streaming

S3_ACCESS_KEY=minio
S3_SECRET_KEY=minio123
S3_BUCKET=music
S3_PREFIX=tracks
S3_ENDPOINT=http://localhost:9002

SECRET_KEY=your-secret-key
ALGORITHM=HS256
ACCESS_TOKEN_EXPIRE_MINUTES=30
REFRESH_TOKEN_EXPIRE_DAYS=7
```

### 3. One-Command Local Startup on Windows
```powershell
.\start-dev.ps1
```

This starts PostgreSQL, MinIO, the backend, and the frontend for local development.

### 4. Run with Docker
```bash
docker compose up --build
```

### 5. Manual Development Setup

**Backend:**
```bash
cd backend
python -m venv venv
venv\Scripts\activate  # Windows
pip install -r requirements.txt
uvicorn main:app --host 0.0.0.0 --port 8001 --reload
```

**Frontend:**
```bash
cd frontend
npm install
npm start
```

## License

MIT License - see [LICENSE](LICENSE)

---

**do-an**  
