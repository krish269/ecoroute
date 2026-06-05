# EcoRoute — AI-Optimized Logistics & Tokenized Circular Economy

EcoRoute transforms urban waste management into a dynamic, incentivized ecosystem using AI and Web3.

## Features

| Feature | Status |
|---|---|
| Resident registration & JWT auth | ✅ |
| Waste photo submission + AI classification | ✅ (mock + real model support) |
| Green Token rewards via smart contract | ✅ (simulation + Polygon testnet) |
| Predictive bin fill-level engine | ✅ |
| VRP-based dynamic route generation | ✅ |
| Citizen portal (submissions, impact, tokens) | ✅ |
| Admin dashboard (analytics, routes, bins) | ✅ |
| Interactive route map (Leaflet) | ✅ |
| ERC-20 GreenToken smart contract | ✅ |

---

## Project Structure

```
ecoroute/
├── backend/          FastAPI + SQLAlchemy + routing engine
│   └── app/
│       ├── main.py           Entry point
│       ├── models.py         Database models
│       ├── auth.py           JWT auth helpers
│       ├── routing.py        Fill prediction + VRP routing
│       ├── vision.py         Waste image classifier
│       ├── token_service.py  Smart contract bridge
│       ├── config.py         Settings
│       ├── seed.py           Demo data seeder
│       └── routers/          API route handlers
├── frontend/         Next.js 14 + TailwindCSS
│   └── src/
│       ├── app/
│       │   ├── login/        Auth page
│       │   ├── portal/       Citizen dashboard
│       │   └── admin/        Admin command center
│       ├── components/       Navbar, RouteMap
│       └── lib/              API client, auth helpers
└── contracts/        Solidity smart contracts
    ├── GreenToken.sol        ERC-20 + mint/redeem
    ├── hardhat.config.js
    └── scripts/deploy.js
```

---

## Quick Start

### 1. Backend

```bash
cd backend
python -m venv .venv
# Windows:
.venv\Scripts\activate
# macOS/Linux:
source .venv/bin/activate

pip install -r requirements.txt
cp .env.example .env         # edit SECRET_KEY at minimum

# Seed demo data (creates admin + resident accounts + 20 bins)
python -m app.seed

# Start the API server
uvicorn app.main:app --reload --port 8000
```

API docs available at: http://localhost:8000/docs

**Demo accounts** (created by seed script):
- Admin: `admin@ecoroute.demo` / `Admin1234!`
- Resident: `resident@ecoroute.demo` / `Resident1234!`

---

### 2. Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local   # or just use defaults
npm run dev
```

Open: http://localhost:3000

---

### 3. Smart Contract (optional — MVP runs in simulation mode without this)

```bash
cd contracts
npm install
npx hardhat compile

# Local Hardhat node
npx hardhat run scripts/deploy.js --network hardhat

# Polygon Amoy testnet
# Set DEPLOYER_PRIVATE_KEY in contracts/.env first
npx hardhat run scripts/deploy.js --network amoy
```

Copy the deployed `CONTRACT_ADDRESS` and `MINTER_PRIVATE_KEY` into `backend/.env`.

---

## Environment Variables

### backend/.env

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `sqlite:///./ecoroute.db` | DB connection string |
| `SECRET_KEY` | *(required)* | JWT signing secret |
| `ACCESS_TOKEN_EXPIRE_HOURS` | `24` | Access token TTL |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `7` | Refresh token TTL |
| `CONTRACT_ADDRESS` | *(blank = simulation)* | Deployed GreenToken address |
| `MINTER_PRIVATE_KEY` | *(blank = simulation)* | Minter wallet private key |
| `WEB3_RPC_URL` | Polygon Amoy | RPC endpoint |
| `VISION_MODEL_PATH` | *(blank = mock)* | Path to Keras .h5 model |

---

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | — | Register resident |
| POST | `/api/auth/login` | — | Login → JWT |
| POST | `/api/auth/refresh` | — | Refresh access token |
| GET | `/api/users/me` | resident | Get profile |
| PUT | `/api/users/me/wallet` | resident | Link wallet address |
| POST | `/api/submissions/` | resident | Submit waste photo |
| GET | `/api/submissions/` | resident | Submission history |
| GET | `/api/submissions/impact` | resident | Impact stats |
| GET | `/api/bins/` | admin | List all bins |
| POST | `/api/bins/` | admin | Register a bin |
| POST | `/api/bins/{id}/fill` | admin | Submit fill reading |
| POST | `/api/bins/fill/bulk` | admin | Bulk fill ingestion |
| POST | `/api/routes/predict` | admin | Run fill predictions |
| POST | `/api/routes/generate` | admin | Generate routes |
| GET | `/api/routes/today` | any auth | Today's routes |
| POST | `/api/routes/stops/{id}/collect` | admin | Mark stop collected |
| GET | `/api/routes/analytics` | admin | System analytics |

---

## Tech Stack

- **Backend**: FastAPI, SQLAlchemy, SQLite (swap for Postgres in production)
- **AI Routing**: Custom nearest-neighbour VRP (swap OR-Tools for production scale)
- **AI Vision**: Mock classifier (plug in Keras/TF or YOLO model via `VISION_MODEL_PATH`)
- **Frontend**: Next.js 14, TailwindCSS, Leaflet, Recharts
- **Blockchain**: Solidity ERC-20, Hardhat, Polygon Amoy testnet
- **Auth**: JWT (access + refresh tokens), bcrypt password hashing
