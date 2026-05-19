# ARIA — Smart Server Room AI System

> Full-stack AI agent dashboard: FastAPI backend + React frontend.  
> Live server metrics · LangChain ReAct agent · SSE streaming · Incident simulations

---

## Stack

| Layer | Tech |
|---|---|
| Frontend | React 18 + Vite, Zustand, Framer Motion, GSAP, Three.js, Chart.js |
| Backend | FastAPI, LangChain, Mistral AI, SSE streaming |
| Tools | OpenWeatherMap, Tavily Search, psutil, simulation engine |
| Database | SQLite (SQLModel + Alembic) |
| Cache | Redis (Upstash) |
| Deploy | Vercel (frontend) · Render (backend) |

---

## Quick start

### 1. Clone and configure

```bash
git clone https://github.com/yourname/aria-system
cd aria-system
```

### 2. Backend

```bash
cd backend
cp .env.example .env
# Edit .env — add your API keys

pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

Backend runs at http://localhost:8000  
API docs at http://localhost:8000/docs

### 3. Frontend

```bash
cd frontend
npm install
npm run dev
```

Frontend runs at http://localhost:5173

---

## API keys needed

| Key | Where to get | Required? |
|---|---|---|
| `MISTRAL_API_KEY` | console.mistral.ai | ✅ Yes |
| `OPENWEATHER_API_KEY` | openweathermap.org/api | Optional |
| `TAVILY_API_KEY` | tavily.com | Optional |

Without optional keys, those tools return a friendly message instead of erroring.

---

## Features

### Chat with ARIA
Type in the command console. ARIA uses ReAct reasoning to call tools and stream back responses word-by-word via SSE. Mood automatically updates based on the reply content.

### Incident simulations
Click the ⚠ button in the dashboard → pick a scenario → trigger it.  
Available scenarios:
- `cpu_spike` — runaway process on Rack 2
- `thermal_runaway` — cooling failure on Node R1
- `network_partition` — BGP failure isolating R2/R3
- `memory_leak` — slow OOM across all 3 nodes
- `recovery` — return to baseline

Or trigger via API:
```bash
curl -X POST http://localhost:8000/sim/trigger \
  -H "Content-Type: application/json" \
  -d '{"scenario": "cpu_spike", "severity": "high"}'
```

### Live metrics
WebSocket at `ws://localhost:8000/ws/metrics` pushes node state every 500ms.  
Charts update in real time — no polling.

---

## Deployment

### Frontend → Vercel

1. Push to GitHub
2. Import repo in Vercel
3. Set env vars:
   - `VITE_API_URL` = `https://your-api.onrender.com`
   - `VITE_WS_URL` = `wss://your-api.onrender.com`

### Backend → Render

1. New Web Service → Docker
2. Connect repo, set root to `backend/`
3. Add env vars from `.env.example`
4. Add a Redis add-on (or use Upstash)
5. Add a persistent disk at `/data` (for SQLite)

---

## Project structure

```
aria-system/
├── backend/
│   ├── main.py              # FastAPI app entry point
│   ├── core/
│   │   ├── config.py        # pydantic-settings
│   │   └── agent.py         # LangChain agent + SSE streaming
│   ├── tools/
│   │   └── all_tools.py     # Weather, news, psutil, simulation tools
│   ├── simulations/
│   │   └── engine.py        # OU-process simulation engine
│   ├── routers/
│   │   ├── chat.py          # POST /chat/stream SSE endpoint
│   │   └── metrics.py       # WS /ws/metrics + /sim/* endpoints
│   ├── models/
│   │   └── db.py            # SQLModel tables
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx          # Main dashboard component
│   │   ├── store/index.js   # Zustand stores
│   │   ├── hooks/
│   │   │   ├── useChat.js   # SSE chat hook
│   │   │   └── useMetricsWS.js  # WebSocket metrics hook
│   │   ├── lib/api.js       # API client
│   │   └── components/
│   │       └── ui/
│   │           ├── MetricsChart.jsx  # Chart.js streaming
│   │           ├── SimPanel.jsx      # Incident simulator UI
│   │           └── AlertBanner.jsx   # Live alert display
│   ├── package.json
│   ├── vite.config.js
│   └── vercel.json
│
└── .github/workflows/ci.yml
```

---

## Adding custom tools

Create a file in `backend/tools/custom/`:

```python
from langchain.tools import tool

@tool
def ping_server(ip: str) -> str:
    """Ping a server IP and return latency."""
    import subprocess
    result = subprocess.run(["ping", "-c", "1", ip], capture_output=True, text=True)
    return result.stdout or result.stderr
```

Then add it to `ALL_TOOLS` in `backend/tools/all_tools.py`.

If it needs human approval, add its name to `APPROVAL_REQUIRED`.
