
<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:0d1117,50:1a1a2e,100:16213e&height=200&section=header&text=ARIA&fontSize=80&fontColor=00d4ff&fontAlignY=38&desc=Autonomous+Realtime+Intelligence+Agent&descAlignY=60&descSize=20&descColor=a0aec0" width="100%"/>

<br/>

<a href="https://aria-smart-server-management-system.vercel.app"><img src="https://img.shields.io/badge/STATUS-LIVE-00ff88?style=for-the-badge&logo=statuspage&logoColor=white&labelColor=0d1117"/></a>
<a href="#"><img src="https://img.shields.io/badge/EVAL-96.7%25_PASS-00d4ff?style=for-the-badge&logo=checkmarx&logoColor=white&labelColor=0d1117"/></a>
<a href="#"><img src="https://img.shields.io/badge/AGENT-ReAct_Loop-bf00ff?style=for-the-badge&logo=openai&logoColor=white&labelColor=0d1117"/></a>
<a href="#"><img src="https://img.shields.io/badge/LLM-Mistral_Small_2506-ff6b35?style=for-the-badge&logo=mistral&logoColor=white&labelColor=0d1117"/></a>
<a href="#"><img src="https://img.shields.io/badge/API-FastAPI-009688?style=for-the-badge&logo=fastapi&logoColor=white&labelColor=0d1117"/></a>
<a href="#"><img src="https://img.shields.io/badge/STREAM-SSE-ff4757?style=for-the-badge&logo=apache&logoColor=white&labelColor=0d1117"/></a>

<br/><br/>

<a href="https://aria-smart-server-management-system.vercel.app"><img src="https://img.shields.io/badge/▲_DEMO-LIVE_ON_VERCEL-000000?style=for-the-badge&logo=vercel&logoColor=white&labelColor=0d1117"/></a>
<a href="https://ragas111-aria-server-management-backend.hf.space"><img src="https://img.shields.io/badge/🤗_API-HUGGING_FACE_SPACES-FFD21E?style=for-the-badge&logoColor=black&labelColor=0d1117"/></a>
<a href="https://ragas111-aria-server-management-backend.hf.space/docs"><img src="https://img.shields.io/badge/📖_SWAGGER-API_DOCS-85EA2D?style=for-the-badge&logo=swagger&logoColor=black&labelColor=0d1117"/></a>
<a href="https://ragas111-aria-server-management-backend.hf.space/health"><img src="https://img.shields.io/badge/💓_HEALTH-CHECK-00ff88?style=for-the-badge&labelColor=0d1117"/></a>

<br/><br/>

> **Monitors · Reasons · Acts · Streams**
>
> ReAct loop · Mistral AI · FastAPI · SSE · Live Incidents · Mood Detection
> 3 nodes · India region · R1 Mumbai · R2 Delhi · R3 Pune

</div>

---

## ⚡ What is ARIA?

**ARIA** (Autonomous Realtime Intelligence Agent) is an AI-powered ops agent that monitors a live server room of **3 nodes** across India, reasons with a **ReAct loop**, streams responses word-by-word via **Server-Sent Events**, detects emotional **mood states** per reply, and simulates realistic incidents using an **Ornstein-Uhlenbeck stochastic process**. Every single agent response includes the current live cluster snapshot — ARIA always knows the real-time situation without burning tool calls on it.

---

## 🌐 Live Deployment

| Service | URL | Status |
|---------|-----|--------|
| ▲ **Frontend** | [aria-smart-server-management-system.vercel.app](https://aria-smart-server-management-system.vercel.app) | ![live](https://img.shields.io/badge/live-00ff88?style=flat-square) |
| 🤗 **Backend API** | [ragas111-aria-server-management-backend.hf.space](https://ragas111-aria-server-management-backend.hf.space) | ![live](https://img.shields.io/badge/live-00ff88?style=flat-square) |
| 📖 **API Docs** | [.hf.space/docs](https://ragas111-aria-server-management-backend.hf.space/docs) | ![live](https://img.shields.io/badge/live-00ff88?style=flat-square) |
| 💓 **Health** | [.hf.space/health](https://ragas111-aria-server-management-backend.hf.space/health) | ![live](https://img.shields.io/badge/live-00ff88?style=flat-square) |

---

## 📊 Evaluation Metrics

<div align="center">

| 🎯 Pass Rate | ✨ Avg Score | ⚡ Avg Latency | 🧠 Context-Only |
|:-----------:|:-----------:|:-------------:|:--------------:|
| **96.7%** | **0.997 / 1.000** | **6.37s** | **63.3%** |
| 29 / 30 cases | near-perfect | min 0.93s · max 34.9s | zero tool calls needed |

</div>

### 📈 Per-Case Latency Distribution

```mermaid
xychart-beta
    title "Latency per test case (seconds) — 30 evals"
    x-axis ["1","2","3","4","5","6","7","8","9","10","11","12","13","14","15","16","17","18","19","20","21","22","23","24","25","26","27","28","29","30"]
    y-axis "seconds" 0 --> 36
    bar [6.78, 3.02, 2.06, 3.58, 2.45, 2.06, 1.76, 1.87, 1.03, 5.05, 2.56, 1.95, 0.93, 15.82, 3.73, 7.63, 4.61, 7.99, 7.98, 10.46, 11.84, 4.45, 6.23, 9.63, 13.54, 1.24, 8.46, 5.04, 2.33, 34.94]
```

> **Case 14** (15.82s) and **Case 30** (34.94s) are multi-tool chains. **Case 20** is the only failure (score=0.9, missing `Delhi` keyword). **63.3%** of cases answered from live context alone — no tools invoked.

### 🔧 Tool Usage Breakdown

```mermaid
pie title Tool Invocations — 17 total calls across 11 cases
    "get_server_metrics" : 6
    "get_top_processes" : 5
    "get_weather" : 2
    "check_datacenter_location" : 2
    "get_forecast" : 1
    "get_news" : 1
```

---

## 🏗️ Architecture

```mermaid
graph TB
    subgraph CLIENT["🖥️  Client Layer"]
        FE["Frontend / UI<br/>HTTP · SSE · GPS · Session"]
    end

    subgraph API["⚡  FastAPI Backend"]
        direction TB
        MW["Rate Limiter<br/>SlowAPI · JWT Auth"]
        CR["/chat/stream<br/>SSE StreamingResponse"]
        MR["/metrics/live<br/>Simulation feed"]
        AR["/auth<br/>JWT + SQLite"]
    end

    subgraph AGENT["🧠  ARIA Agent Core (ReAct)"]
        direction TB
        SC["Server Context Builder<br/>Live snapshot injection"]
        SYS["System Prompt<br/>+ Real-time cluster state"]
        LLM["Mistral Small 2506<br/>LangChain wrapper · temp=0.3"]
        PARSER["ReAct Parser<br/>Thought / Action / Final"]
        MOOD["Mood Extractor<br/>14 emotional states"]
        HIST["Conversation History<br/>last 20 messages"]
    end

    subgraph TOOLS["🔧  Tool Registry (7 tools)"]
        T1["🌤 get_weather<br/>OpenWeatherMap"]
        T2["📅 get_forecast<br/>3-day forecast"]
        T3["📰 get_news<br/>Tavily search"]
        T4["💻 get_server_metrics<br/>psutil"]
        T5["🔬 get_top_processes<br/>psutil · needs approval"]
        T6["⚡ trigger_simulation<br/>needs approval"]
        T7["📍 check_datacenter<br/>static registry"]
    end

    subgraph SIM["🔬  Simulation Engine"]
        OU["Ornstein-Uhlenbeck<br/>stochastic process"]
        R1["R1 · Mumbai<br/>Tier III · Rack A-01"]
        R2["R2 · Delhi<br/>Tier II · Rack B-03"]
        R3["R3 · Pune<br/>Tier III · Rack C-07"]
        SC5["Scenarios:<br/>cpu_spike · thermal_runaway<br/>network_partition · memory_leak<br/>recovery"]
    end

    subgraph DB["🗄️  Persistence"]
        SQL["SQLite · SQLModel<br/>messages · sessions · users"]
    end

    FE -->|"POST /chat/stream"| MW
    MW --> CR
    CR -->|"snapshot + location"| SC
    SC --> SYS
    SYS --> LLM
    LLM --> PARSER
    PARSER -->|"Action"| TOOLS
    PARSER -->|"Final Answer"| MOOD
    MOOD -->|"SSE: token/mood/done"| FE
    TOOLS -->|"Tool Result"| LLM
    OU --> R1 & R2 & R3
    SC5 --> OU
    R1 & R2 & R3 -->|"snapshot()"| SC
    R1 & R2 & R3 -->|"SSE stream"| MR
    CR --> DB
    AR --> DB

    classDef agentNode fill:#1a1a2e,stroke:#00d4ff,color:#fff
    classDef toolNode fill:#16213e,stroke:#bf00ff,color:#fff
    classDef simNode fill:#0d2118,stroke:#00ff88,color:#fff
    classDef apiNode fill:#1e150d,stroke:#ff6b35,color:#fff
    classDef dbNode fill:#1a1218,stroke:#ff4757,color:#fff

    class SC,SYS,LLM,PARSER,MOOD,HIST agentNode
    class T1,T2,T3,T4,T5,T6,T7 toolNode
    class OU,R1,R2,R3,SC5 simNode
    class MW,CR,MR,AR apiNode
    class SQL dbNode
```

---

## 🔄 ReAct Agent Loop

```mermaid
flowchart LR
    A([👤 User Query]) --> B

    subgraph CTX["Context Injection"]
        B["Fetch live snapshot\nfrom SimEngine"]
        C["Build server context\n+ datacenter geo\n+ operator GPS"]
        B --> C
    end

    C --> D["Prepend to\nSystem Prompt"]
    D --> E(["🧠 Mistral LLM\ncall"])

    E --> F{Parse\nReAct output}

    F -->|"Thought + Action"| G["Emit thought\nSSE event"]
    G --> H{Tool\nneeds\napproval?}
    H -->|Yes| I["⏸ Pause —\nWait for\nhuman approval"]
    I -->|Approved| J["🔧 Execute Tool"]
    I -->|Denied| K["Skip tool\ncontinue"]
    H -->|No| J
    J --> L["Emit tool_use\n+ tool_result SSE"]
    L --> M{Loop guard\nsame tool ≥ 3×?}
    M -->|Yes| N["Force synthesis\nprompt → Final"]
    M -->|No| E

    F -->|"Final Answer"| O["Stream answer\nword-by-word SSE"]
    K --> E
    N --> O
    O --> P["Extract mood\n14 states"]
    P --> Q["Emit done SSE\n+ save to DB"]
    Q --> R([✅ Response complete])

    F -->|"MAX_ITER=6\nexhausted"| N

    style A fill:#1a2e1a,stroke:#00ff88
    style R fill:#1a2e1a,stroke:#00ff88
    style E fill:#1a1a2e,stroke:#00d4ff
    style I fill:#2e1a0d,stroke:#ff6b35
    style N fill:#2e0d0d,stroke:#ff4757
```

---

## 🎭 Simulation Engine — Incident Scenarios

```mermaid
xychart-beta
    title "Incident Phases — CPU % over time"
    x-axis ["t=0","t=20","t=50","t=90","t=110"] 
    y-axis "CPU %" 0 --> 100
    line [20, 65, 92, 99, 30]
```

```mermaid
graph LR
    subgraph SCENARIOS["⚡ 5 Incident Scenarios"]
        A["💥 cpu_spike<br/>R2 · 120s<br/>😱 panicked"]
        B["🔥 thermal_runaway<br/>R1 · 90s<br/>😡 furious"]
        C["🌐 network_partition<br/>R2+R3 · 100s<br/>😲 shocked"]
        D["🧠 memory_leak<br/>All nodes · 110s<br/>😢 melancholy"]
        E["✅ recovery<br/>All nodes · 60s<br/>😊 elated"]
    end

    subgraph PHYSICS["🔬 OU Process Physics"]
        OU["dX = θ(μ−X)dt + σ·dW<br/>θ=0.15 · σ=1.2 · dt=0.5"]
    end

    OU --> A & B & C & D & E
```

| Scenario | Affected | Duration | Peak Metric | Mood |
|----------|---------|---------|-------------|------|
| `cpu_spike` | R2 | 120s | CPU 99% | 😱 panicked |
| `thermal_runaway` | R1 | 90s | Temp 88°C | 😡 furious |
| `network_partition` | R2, R3 | 100s | Net 5 Mbps | 😲 shocked |
| `memory_leak` | All | 110s | RAM 95% | 😢 melancholy |
| `recovery` | All | 60s | — | 😊 elated |

---

## 🎭 Mood State Machine

ARIA detects an emotional **mood per response** — 14 possible states — biased by active incidents:

```mermaid
stateDiagram-v2
    [*] --> neutral : Idle / baseline

    neutral --> panicked : cpu_spike detected
    neutral --> furious : thermal_runaway detected
    neutral --> shocked : network_partition detected
    neutral --> melancholy : memory_leak detected
    neutral --> calm : all metrics nominal
    neutral --> elated : recovery complete
    neutral --> sunny : weather query · clear sky
    neutral --> puzzled : ambiguous query
    neutral --> resolute : clear action taken
    neutral --> retro : system summary
    neutral --> dreamy : low-activity period

    panicked --> elated : cpu resolved
    furious --> elated : temp normalized
    shocked --> elated : network restored
    melancholy --> elated : OOM prevented

    note right of panicked : cpu_spike scenario
    note right of furious : thermal_runaway scenario
    note right of shocked : network_partition scenario
    note right of melancholy : memory_leak scenario
```

---

## 🛠️ Tech Stack

<div align="center">

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **LLM** | Mistral Small 2506 | ReAct reasoning · temp=0.3 |
| **Agent Framework** | LangChain | Tool binding · message types |
| **API** | FastAPI | Async · SSE · rate limiting |
| **Streaming** | Server-Sent Events | Word-by-word token stream |
| **Simulation** | Ornstein-Uhlenbeck | Realistic metric physics |
| **DB** | SQLite + SQLModel | Session · message · user |
| **Auth** | JWT | Bearer token auth |
| **Weather** | OpenWeatherMap | Live weather at node cities |
| **News** | Tavily | Real-time news search |
| **Metrics** | psutil | Host CPU · RAM · disk · net |
| **Container** | Docker | Single-container deploy |
| **Rate Limit** | SlowAPI | Per-IP throttling |
| **Frontend** | Vercel | React UI · SSE consumer |
| **Backend Host** | Hugging Face Spaces | FastAPI deployment |

</div>

---

## 📁 Project Structure

```
aria/
├── frontend/                         # → Vercel deployment
│   └── ...                           # React UI · SSE consumer · GPS
│
├── backend/                          # → Hugging Face Spaces
│   ├── core/
│   │   ├── agent.py          # ReAct loop · streaming · mood · history
│   │   └── config.py         # Pydantic settings · env vars
│   ├── routers/
│   │   ├── chat.py           # /chat/stream · /chat/approve · /chat/history
│   │   ├── metrics.py        # /metrics/live SSE feed
│   │   └── auth.py           # /auth/register · /auth/login
│   ├── simulations/
│   │   └── engine.py         # OU process · 5 scenarios · snapshot()
│   ├── tools/
│   │   └── all_tools.py      # 7 LangChain tools · approval registry
│   ├── models/
│   │   ├── user.py           # User SQLModel
│   │   └── db.py             # SQLite engine · session · Message model
│   ├── tests/
│   │   ├── test_api.py       # API integration tests
│   │   ├── test_aria_quality.py  # Quality eval harness
│   │   ├── test_deep.py      # Deep scenario tests
│   │   └── aria_eval_results.json  # 30-case eval · 96.7% pass
│   ├── main.py               # FastAPI app · lifespan · CORS · routes
│   ├── requirements.txt
│   ├── Dockerfile
│   └── .env.example
└── .gitignore
```

---

## 🚀 Quick Start

> **No setup needed** — live stack already deployed:
> - Frontend → [aria-smart-server-management-system.vercel.app](https://aria-smart-server-management-system.vercel.app)
> - API → [ragas111-aria-server-management-backend.hf.space](https://ragas111-aria-server-management-backend.hf.space)

### Run locally

#### 1 · Clone & configure

```bash
git clone https://github.com/YOUR_USERNAME/aria.git
cd aria/backend
cp .env.example .env
```

Edit `.env`:

```env
MISTRAL_API_KEY=your_mistral_key
OPENWEATHER_API_KEY=your_owm_key      # optional — weather tools
TAVILY_API_KEY=your_tavily_key        # optional — news tool
SECRET_KEY=your_jwt_secret
CORS_ORIGINS=http://localhost:3000
```

#### 2 · Run backend

```bash
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

#### 3 · Docker

```bash
docker build -t aria .
docker run -p 8000:8000 --env-file .env aria
```

#### 4 · Chat with ARIA

```bash
# Against live API
curl -N -X POST https://ragas111-aria-server-management-backend.hf.space/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"message": "What is the current server status?", "session_id": "demo"}'

# Or local
curl -N -X POST http://localhost:8000/chat/stream \
  -H "Content-Type: application/json" \
  -d '{"message": "Trigger a cpu_spike on R2", "session_id": "demo"}'
```

---

## 📡 API Reference

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/chat/stream` | Stream agent response (SSE) |
| `POST` | `/chat/approve` | Approve/deny tool call |
| `GET`  | `/chat/history/{session_id}` | Fetch message history |
| `GET`  | `/chat/context` | Preview live ARIA context |
| `GET`  | `/metrics/live` | SSE stream of node metrics |
| `POST` | `/auth/register` | Create account |
| `POST` | `/auth/login` | Get JWT token |
| `GET`  | `/health` | Liveness check |

### SSE Event Types

```
event: thought      → ARIA's internal reasoning step
event: tool_use     → tool name + args being invoked
event: tool_result  → tool output (truncated at 800 chars)
event: token        → answer chunk (5 words at a time)
event: mood         → { mood: "panicked", reason: "..." }
event: done         → final full text + session_id + mood
event: error        → error message
```

---

## 🗺️ Datacenter Registry

```mermaid
graph TB
    subgraph INDIA["🇮🇳 India Region"]
        R1["🟢 R1 · Mumbai<br/>19.08°N 72.88°E<br/>Rack A-01 · Tier III"]
        R2["🟢 R2 · Delhi<br/>28.61°N 77.21°E<br/>Rack B-03 · Tier II"]
        R3["🟢 R3 · Pune<br/>18.52°N 73.86°E<br/>Rack C-07 · Tier III"]
    end

    R1 <-->|"1,393 km"| R2
    R1 <-->|"149 km"| R3
    R2 <-->|"1,244 km"| R3
```

Operator GPS is injected at runtime — ARIA computes haversine distance to each node and marks the nearest datacenter in every response.

---

## 🔑 Key Design Decisions

**Context injection over tool calls** — Every request embeds the live cluster snapshot directly into the system prompt. ARIA answers 63% of queries without any tool call, saving latency and API cost.

**Loop guard** — If the same tool is called 3+ times in one turn, ARIA is forced into a synthesis prompt to avoid infinite loops (a real problem with ReAct agents).

**Approval gates** — `trigger_simulation` and `get_top_processes` require explicit human approval before execution, preventing runaway automated actions on live infrastructure.

**Ornstein-Uhlenbeck physics** — Metrics don't random-walk; they drift toward scenario targets with noise, producing realistic smooth curves that mimic real server telemetry.

**Mood biasing** — Active incidents override the LLM's mood inference with the scenario's predefined mood, ensuring ARIA's emotional state always matches the ops situation.

---

<div align="center">

<img src="https://capsule-render.vercel.app/api?type=waving&color=0:16213e,50:1a1a2e,100:0d1117&height=100&section=footer&text=ARIA+%C2%B7+Always+Watching&fontSize=18&fontColor=00d4ff&fontAlignY=65" width="100%"/>

**Built with** `FastAPI` · `Mistral AI` · `LangChain` · `Server-Sent Events` · `SQLite` · `Docker` · `Python 3.11+`

</div>
