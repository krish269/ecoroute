# EcoRoute — Project Overview

## What is EcoRoute?

EcoRoute is a smart waste management platform that uses AI and blockchain to make city waste collection more efficient and reward citizens for recycling properly.

It solves two problems cities face today:
- **Wasted fuel** — trucks drive fixed routes collecting half-empty bins
- **Poor recycling** — citizens have no incentive to sort waste correctly

---

## How it works

### For Citizens
1. Take a photo of your sorted waste (plastics, electronics, organics)
2. The AI checks if it's properly segregated
3. If valid — Green Tokens are instantly sent to your crypto wallet
4. Track your token balance, CO₂ saved, and submission history on your dashboard

### For City Administrators
1. IoT sensors report bin fill levels across the city
2. The AI predicts which bins will be full by tomorrow
3. The system generates optimised routes — trucks only visit bins that actually need emptying
4. Fleet operators see live routes on a map and mark stops as collected

---

## Core Features

| Feature | What it does |
|---|---|
| **AI Waste Classification** | Analyses waste photos and classifies them as plastics, electronics, organics, or non-segregated |
| **Duplicate Detection** | Perceptual hashing prevents the same image being submitted multiple times to farm tokens |
| **Green Token Rewards** | ERC-20 smart contract on Polygon automatically mints tokens to verified recyclers |
| **Predictive Fill Engine** | Uses historical sensor data and zone density to predict bin fill levels daily |
| **Dynamic Route Generation** | Vehicle routing algorithm assigns optimal collection routes, respecting 8-hour driver limits |
| **Sensor Simulation** | Admin can push realistic fill-level readings to all bins to test the routing system live |
| **Live Bin Map** | Interactive map showing all bins colour-coded by fill level (green/amber/red) |
| **Citizen Portal** | Personal dashboard showing token balance, submission history, CO₂ saved, and waste weight |
| **Admin Command Center** | Real-time fleet analytics, route management, prediction accuracy metrics |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Backend API | FastAPI (Python) |
| Database | SQLite (SQLAlchemy ORM) |
| AI Classification | Mock classifier (plug-in ready for TensorFlow/YOLO) |
| Route Optimisation | Nearest-neighbour VRP algorithm with Haversine distance |
| Smart Contract | Solidity ERC-20 on Polygon Amoy testnet |
| Frontend | Next.js 14 + TailwindCSS |
| Maps | Leaflet + OpenStreetMap |
| Auth | JWT access + refresh tokens, bcrypt passwords |
| Hosting | Render (backend) + Vercel (frontend) |

---

## Token Economy

Waste category → Green Tokens awarded per validated submission:

| Category | Tokens |
|---|---|
| Electronics | 25 GRN |
| Plastics | 10 GRN |
| Organics | 5 GRN |

Tokens are redeemable for public transit credits or local business discounts via the smart contract's `redeem()` function.

---

## Demo Accounts

| Role | Email | Password |
|---|---|---|
| Admin | admin@ecoroute.demo | Admin1234! |
| Resident | resident@ecoroute.demo | Resident1234! |

---

## Live URLs

- **Frontend:** https://ecooroute-l4k6k5k00-krishs-projects-5461cb43.vercel.app
- **Backend API:** https://ecoroute-6jhg.onrender.com
- **API Docs:** https://ecoroute-6jhg.onrender.com/docs
- **GitHub:** https://github.com/krish269/ecoroute
