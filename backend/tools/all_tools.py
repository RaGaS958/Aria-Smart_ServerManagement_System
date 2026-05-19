import os, requests, json
from langchain.tools import tool
from tavily import TavilyClient
from core.config import settings

# ── Weather ──────────────────────────────────────────────────────────────────
@tool
def get_weather(city: str) -> str:
    """Get current weather for a city. Use for any weather / temperature query."""
    api_key = settings.openweather_api_key
    if not api_key:
        return "Weather API key not configured. Set OPENWEATHER_API_KEY in .env"
    url = f"http://api.openweathermap.org/data/2.5/weather?q={city}&appid={api_key}&units=metric"
    r = requests.get(url, timeout=10)
    if r.status_code == 200:
        d = r.json()
        desc = d["weather"][0]["description"]
        temp = d["main"]["temp"]
        feels = d["main"]["feels_like"]
        humidity = d["main"]["humidity"]
        wind = d["wind"]["speed"]
        return (
            f"Weather in {city}: {desc}, {temp}°C (feels like {feels}°C), "
            f"humidity {humidity}%, wind {wind} m/s"
        )
    return f"Could not retrieve weather for {city} (status {r.status_code})"


@tool
def get_forecast(city: str) -> str:
    """Get 3-day weather forecast for a city."""
    api_key = settings.openweather_api_key
    if not api_key:
        return "Weather API key not configured."
    url = f"http://api.openweathermap.org/data/2.5/forecast?q={city}&appid={api_key}&units=metric&cnt=8"
    r = requests.get(url, timeout=10)
    if r.status_code != 200:
        return f"Could not fetch forecast for {city}"
    items = r.json().get("list", [])
    lines = []
    for item in items[:4]:
        t = item["dt_txt"]
        desc = item["weather"][0]["description"]
        temp = item["main"]["temp"]
        lines.append(f"  {t}: {desc}, {temp}°C")
    return f"Forecast for {city}:\n" + "\n".join(lines)


# ── News ──────────────────────────────────────────────────────────────────────
_tavily: TavilyClient | None = None

def _get_tavily():
    global _tavily
    if _tavily is None:
        if not settings.tavily_api_key:
            return None
        _tavily = TavilyClient(api_key=settings.tavily_api_key)
    return _tavily


@tool
def get_news(query: str) -> str:
    """Search for latest news about a topic, city, or event using Tavily."""
    client = _get_tavily()
    if not client:
        return "Tavily API key not configured. Set TAVILY_API_KEY in .env"
    resp = client.search(query=f"latest news {query}", search_depth="basic", max_results=3)
    results = resp.get("results", [])
    if not results:
        return f"No news found for: {query}"
    out = [f"News: {query}\n"]
    for r in results:
        out.append(f"• {r.get('title', 'No title')}\n  {r.get('content', '')[:150]}...\n  {r.get('url', '')}")
    return "\n".join(out)


# ── Server / System metrics ────────────────────────────────────────────────────
@tool
def get_server_metrics(node: str = "all") -> str:
    """Get current CPU, RAM, disk, and network metrics for server nodes."""
    try:
        import psutil
        cpu = psutil.cpu_percent(interval=0.5)
        mem = psutil.virtual_memory()
        disk = psutil.disk_usage("/")
        net = psutil.net_io_counters()
        return (
            f"Server metrics (node: {node}):\n"
            f"  CPU: {cpu}%\n"
            f"  RAM: {mem.percent}% used ({mem.used // 1024**2} MB / {mem.total // 1024**2} MB)\n"
            f"  Disk: {disk.percent}% used\n"
            f"  Net TX: {net.bytes_sent // 1024} KB | RX: {net.bytes_recv // 1024} KB"
        )
    except Exception as e:
        return f"Could not retrieve metrics: {e}"


@tool
def get_top_processes(limit: int = 5) -> str:
    """Get the top CPU-consuming processes on the server."""
    try:
        import psutil
        procs = []
        for p in psutil.process_iter(["pid", "name", "cpu_percent", "memory_percent"]):
            try:
                procs.append(p.info)
            except psutil.NoSuchProcess:
                pass
        procs.sort(key=lambda x: x.get("cpu_percent", 0), reverse=True)
        top = procs[:limit]
        lines = [f"Top {limit} processes by CPU:"]
        for p in top:
            lines.append(f"  PID {p['pid']} | {p['name']} | CPU {p.get('cpu_percent',0):.1f}% | MEM {p.get('memory_percent',0):.1f}%")
        return "\n".join(lines)
    except Exception as e:
        return f"Could not list processes: {e}"


@tool
def trigger_simulation(scenario: str, severity: str = "medium") -> str:
    """Trigger a server simulation scenario to demonstrate incident response.
    
    Valid scenarios: cpu_spike, thermal_runaway, network_partition, memory_leak, recovery
    Valid severities: low, medium, high, critical
    """
    valid_scenarios = ["cpu_spike", "thermal_runaway", "network_partition", "memory_leak", "recovery"]
    valid_severities = ["low", "medium", "high", "critical"]
    if scenario not in valid_scenarios:
        return f"Unknown scenario '{scenario}'. Valid: {', '.join(valid_scenarios)}"
    if severity not in valid_severities:
        return f"Unknown severity '{severity}'. Valid: {', '.join(valid_severities)}"
    # This tool signals the simulation engine via a shared state flag
    # The actual trigger happens in the simulation router
    return json.dumps({
        "action": "trigger_simulation",
        "scenario": scenario,
        "severity": severity,
        "status": "queued",
        "message": f"Simulation '{scenario}' at severity '{severity}' has been queued. Monitoring metrics now."
    })


@tool
def check_datacenter_location(datacenter_id: str) -> str:
    """Look up the physical location and risk profile of a datacenter node."""
    locations = {
        "R1": {"city": "Mumbai", "lat": 19.08, "lon": 72.88, "rack": "A-01", "tier": "Tier III"},
        "R2": {"city": "Delhi",  "lat": 28.61, "lon": 77.21, "rack": "B-03", "tier": "Tier II"},
        "R3": {"city": "Pune",   "lat": 18.52, "lon": 73.86, "rack": "C-07", "tier": "Tier III"},
    }
    info = locations.get(datacenter_id.upper())
    if not info:
        return f"Unknown datacenter ID: {datacenter_id}. Known IDs: {', '.join(locations.keys())}"
    return (
        f"Datacenter {datacenter_id}: {info['city']} "
        f"(lat {info['lat']}, lon {info['lon']}) | "
        f"Rack {info['rack']} | {info['tier']}"
    )


# ── Exported list ─────────────────────────────────────────────────────────────
ALL_TOOLS = [
    get_weather,
    get_forecast,
    get_news,
    get_server_metrics,
    get_top_processes,
    trigger_simulation,
    check_datacenter_location,
]

# Tools that require human approval before execution
APPROVAL_REQUIRED = {"trigger_simulation", "get_top_processes"}
