# EcoRoute — AI-Optimized Logistics & Tokenized Circular Economy

> Smart waste management powered by AI routing, computer vision, and blockchain rewards.

## 🌐 Live Demo

| | URL |
|---|---|
| **Frontend** | https://ecooroute-l4k6k5k00-krishs-projects-5461cb43.vercel.app |
| **Backend API** | https://ecoroute-6jhg.onrender.com |
| **API Docs** | https://ecoroute-6jhg.onrender.com/docs |

### Demo Accounts

| Role | Email | Password |
|---|---|---|
| 🔑 Admin | admin@ecoroute.demo | Admin1234! |
| 👤 Resident | resident@ecoroute.demo | Resident1234! |

---

## What is EcoRoute?

EcoRoute transforms urban waste management from a static utility into a dynamic, incentivized ecosystem using AI and Web3.

- **City trucks** drive smarter routes — only visiting bins that are actually full
- **Citizens** earn crypto tokens for sorting waste correctly
- **Administrators** get a live command center with maps, analytics, and predictions

---

## Features

| Feature | Description |
|---|---|
| 📸 AI Waste Classification | Photo → AI classifies as plastics, electronics, organics, or non-segregated |
| 🔁 Duplicate Detection | Perceptual hashing blocks the same image being submitted twice |
| 🪙 Green Token Rewards | ERC-20 smart contract on Polygon mints tokens automatically |
| 📊 Predictive Fill Engine | Predicts bin fill levels daily using historical sensor data |
| 🗺️ Dynamic Route Generation | VRP algorithm generates optimised fleet routes |
| ⚡ Sensor Simulation | Push realistic fill readings to all bins with one click |
| 🗺️ Live Bin Map | Interactive map — bins coloured green/amber/red by fill level |
| 👤 Citizen Portal | Token balance, submission history, CO₂ saved, waste weight |
| 🏙️ Admin Dashboard | Fleet analytics, route management, prediction accuracy |

---

## Token Rewards

| Waste Type | Tokens Earned |
|---|---|
| ♻️ Electronics | 25 GRN |
| 🧴 Plastics | 10 GRN |
| 🥬 Organics | 5 GRN |

Tokens are redeemable for transit credits or local business discounts via the smart contract.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend | FastAPI (Python) |
| Database | SQLite via SQLAlchemy |
| AI Vision | Mock classifier (plug-in ready for TensorFlow/YOLO) |
| Routing | Nearest-neighbour VRP + Haversine distance |
| Smart Contract | Solidity ERC-20 — Polygon Amoy testnet |
| Frontend | Next.js 14 + TailwindCSS |
| Maps | Leaflet + OpenStreetMap |
| Auth | JWT + bcrypt |
| Hosting | Render (backend) + Vercel (frontend) |

---

## Project Structure

```
ecoroute/
├── backend/                  FastAPI + SQLAlchemy
│   └── app/
│       ├── main.py           Entry point
│       ├── models.py         Database models
│       ├── auth.py           JWT auth
│       ├── routing.py        Fill prediction + VRP
│       ├── vision.py         Waste image classifier
│       ├── token_service.py  Blockchain bridge
│       ├── seed.py           Demo data seeder
│       └── routers/          API endpoints
├── frontend/                 Next.js 14
│   └── src/
│       ├── app/
│       │   ├── login/        Auth page
│       │   ├── portal/       Citizen dashboard
│       │   └── admin/        Admin command center
│       ├── components/       Navbar, BinMap, RouteMap
│       └── lib/              API client, auth helpers
└── contracts/
    ├── GreenToken.sol        ERC-20 smart contract
    └── scripts/deploy.js     Hardhat deploy script
```

---

## Run Locally

### Backend
```bash
cd backend
python -m venv .venv
.venv\Scripts\activate        # Windows
pip install -r requirements.txt
cp .env.example .env          # edit SECRET_KEY
python -m app.seed            # create demo accounts + bins
uvicorn app.main:app --reload --port 8000
```

### Frontend
```bash
cd frontend
npm install
# create .env.local with:
# NEXT_PUBLIC_API_URL=http://localhost:8000
npm run dev
```

### Smart Contract (optional)
```bash
cd contracts
npm install
npx hardhat compile
npx hardhat run scripts/deploy.js --network amoy
```

---

## API Endpoints

| Method | Path | Auth | Description |
|---|---|---|---|
| POST | `/api/auth/register` | — | Register resident |
| POST | `/api/auth/login` | — | Login → JWT |
| POST | `/api/auth/refresh` | — | Refresh token |
| GET | `/api/users/me` | resident | Get profile |
| PUT | `/api/users/me/wallet` | resident | Link wallet |
| POST | `/api/submissions/` | resident | Submit waste photo |
| GET | `/api/submissions/` | resident | Submission history |
| GET | `/api/submissions/impact` | resident | Impact stats |
| GET | `/api/bins/` | admin | List bins |
| POST | `/api/bins/` | admin | Register bin |
| POST | `/api/bins/simulate` | admin | Simulate sensor readings |
| POST | `/api/routes/predict` | admin | Run fill predictions |
| POST | `/api/routes/generate` | admin | Generate routes |
| GET | `/api/routes/today` | any | Today's routes |
| POST | `/api/routes/stops/{id}/collect` | admin | Mark stop collected |
| GET | `/api/routes/analytics` | admin | System analytics |
