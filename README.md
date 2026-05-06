# 🌐 Project Eco-Nexus — The Cyber-Sustainability Simulator

![License: MIT](https://img.shields.io/badge/License-MIT-00f2ff.svg)
![Deployment: Render](https://img.shields.io/badge/Deployment-Render.com-cyan.svg)
![Framework: React 19](https://img.shields.io/badge/Framework-React%2019-blue.svg)

> **"Redefining environmental impact through high-fidelity simulation."**
> **Founded by PVP_PRO (Utkarsh Pandey) and Developed with Nishant Amrit.**

---

## 🚀 Executive Summary
**Eco-Nexus** is a next-generation, full-stack 3D multiplayer cleanup simulator. Built on a **Glassmorphism** UI philosophy and powered by a custom **Three.js** engine, it merges addictive "Simulator" gameplay with real-world sustainability education.

### 🛠️ The Tech Stack
* **Frontend**: React 19, Vite 7, Three.js, Tailwind CSS v4.
* **Backend**: Node.js (Express 5) + WebSocket (`ws`) for persistent real-time sync.
* **Infrastructure**: Optimized for **Render.com** Linux environments[cite: 1, 2].

---

## 💎 Exclusive Simulator Features

### 🎮 Informative Gameplay Modes
* **Sorting Mechanic**: Items are categorized into **Plastic, E-Waste, and Organic**. Players must sort correctly to maximize Coin yields.
* **Sustainability Facts**: Clicking on waste triggers informative popups regarding real-world decomposition and recycling[cite: 1].
* **Eco-Evolution**: A dynamic **Eco-Meter** transitions the skybox from "Smoggy Grey" to "Vibrant Cyan" as cleanup milestones are reached[cite: 1].

### 🤖 Automation: The Mink Series
* **Mink Drones**: Specialized rabbit-themed AI companions that pathfind to trash, auto-collect, and provide real-time data analysis[cite: 1, 2].

### 🔐 The Administrative Layer (Owner Systems)
Access the hidden **Cyber-Nexus Console** (Press `P` / Password: `Slayers`) to unlock[cite: 1]:
* **`PVP_PRO` (Overlord)**: Infinite Capacity + Gojo-themed "Unlimited" visual aura[cite: 1, 2].
* **`Slayers` (Specialist)**: 3x Coin Multiplier + Executioner Vacuum[cite: 1].
* **`NordenMC` (Developer)**: Hidden Admin Dashboard and real-time map manipulation[cite: 1, 2].

---

## 📂 Project Architecture
The project is structured as a clean monorepo. **Note: `node_modules` are strictly excluded to ensure build stability[cite: 1, 2].**
```text
/ECO_CLEAN-main
├── /client             # React + Three.js (Front-end Game Engine)
│   ├── /src
│   │   ├── game.ts     # Core Simulation Logic (Fixed Runtime)
│   │   └── App.tsx     # Glassmorphism UI & HUD
│   └── package.json
├── /server             # Node.js + WebSocket (Secure Backend)
│   ├── index.js        # Owner Ranks & Privilege Logic
│   └── package.json
├── render.yaml         # Automated Deployment Blueprint
└── README.md
