#!/usr/bin/env python3
"""
Coletor de métricas da VPS Evolution (Monitoramento Evolution — Super Admin AtendeChat).

Somente leitura e só biblioteca padrão:
  - host: /proc/stat, /proc/meminfo, /proc/loadavg, statvfs(COLLECTOR_DISK_PATH)
  - contêineres: <docker-root>/containers/<id>/config.v2.json (estado, início, reinícios;
    o health do Docker não é persistido nesse arquivo e por isso não é reportado)
    e cgroups (CPU/RAM). Não usa o socket do Docker nem executa comandos.

A cada COLLECTOR_INTERVAL_SECONDS envia a amostra para COLLECTOR_INGEST_URL
(Authorization: Bearer COLLECTOR_INGEST_TOKEN). Falhas temporárias ficam em buffer
limitado (COLLECTOR_MAX_BUFFER amostras) e são reenviadas no ciclo seguinte.
"""

import glob
import json
import os
import socket
import sys
import time
import urllib.error
import urllib.request
from collections import deque
from datetime import datetime, timezone

ROLES = ("api", "postgres", "redis")
MAX_BATCH = 500
ZERO_TIME = "0001-01-01T00:00:00Z"


def log(message):
    print(message, flush=True)


def iso_now():
    return iso_from_dt(datetime.now(timezone.utc))


def iso_from_dt(dt):
    return dt.astimezone(timezone.utc).isoformat(timespec="milliseconds").replace("+00:00", "Z")


def iso_from_docker(value):
    """'2026-10-19T11:00:04.490207812Z' (nanossegundos) -> ISO com milissegundos."""
    if not value or value.startswith("0001-01-01"):
        return None
    base, _, rest = value.rstrip("Z").partition(".")
    try:
        dt = datetime.strptime(base, "%Y-%m-%dT%H:%M:%S").replace(tzinfo=timezone.utc)
    except ValueError:
        return None
    millis = int((rest + "000")[:3]) if rest.isdigit() else 0
    return iso_from_dt(dt.replace(microsecond=millis * 1000))


def read_text(path):
    with open(path, "r", encoding="utf-8") as fh:
        return fh.read()


# ------------------------------------------------------------------------ host

def read_cpu_times(proc_root):
    """(total, idle, cores, boot_epoch) de /proc/stat. idle inclui iowait."""
    total = idle = cores = 0
    boot = None
    for line in read_text(os.path.join(proc_root, "stat")).splitlines():
        parts = line.split()
        if not parts:
            continue
        if parts[0] == "cpu":
            values = [int(v) for v in parts[1:]]
            # guest/guest_nice já estão somados em user/nice.
            total = sum(values[:8])
            idle = values[3] + (values[4] if len(values) > 4 else 0)
        elif parts[0].startswith("cpu") and parts[0][3:].isdigit():
            cores += 1
        elif parts[0] == "btime":
            boot = int(parts[1])
    return total, idle, cores, boot


def cpu_percent(prev, cur):
    total = cur[0] - prev[0]
    idle = cur[1] - prev[1]
    if total <= 0:
        return 0.0
    return round(min(100.0, max(0.0, (1 - idle / total) * 100)), 2)


def read_memory(proc_root):
    info = {}
    for line in read_text(os.path.join(proc_root, "meminfo")).splitlines():
        key, _, rest = line.partition(":")
        fields = rest.split()
        if fields:
            info[key] = int(fields[0]) * 1024
    total = info["MemTotal"]
    available = min(info.get("MemAvailable", info.get("MemFree", 0)), total)
    return {"memTotalBytes": total, "memUsedBytes": total - available, "memAvailableBytes": available}


def read_disk(path):
    st = os.statvfs(path)
    total = st.f_blocks * st.f_frsize
    used = (st.f_blocks - st.f_bfree) * st.f_frsize
    available = st.f_bavail * st.f_frsize
    return {"diskTotalBytes": total, "diskUsedBytes": min(used, total), "diskAvailableBytes": min(available, total)}


def read_load(proc_root):
    parts = read_text(os.path.join(proc_root, "loadavg")).split()
    return {"load1": float(parts[0]), "load5": float(parts[1]), "load15": float(parts[2])}


# ------------------------------------------------------------------ contêineres

def docker_state(state):
    """Mesma regra do Docker (State.StateString)."""
    if state.get("Running"):
        if state.get("Paused"):
            return "paused"
        if state.get("Restarting"):
            return "restarting"
        return "running"
    if state.get("RemovalInProgress"):
        return "removing"
    if state.get("Dead"):
        return "dead"
    if not state.get("StartedAt") or state.get("StartedAt") == ZERO_TIME:
        return "created"
    return "exited"


def load_containers(docker_root):
    """{nome: config} lido de config.v2.json (somente leitura)."""
    found = {}
    for path in glob.glob(os.path.join(docker_root, "containers", "*", "config.v2.json")):
        try:
            data = json.loads(read_text(path))
        except (OSError, ValueError):
            continue
        name = str(data.get("Name") or "").lstrip("/")
        if name:
            found[name] = data
    return found


def cgroup_dir(cgroup_root, container_id):
    for candidate in (
        os.path.join(cgroup_root, "system.slice", "docker-%s.scope" % container_id),
        os.path.join(cgroup_root, "docker", container_id),
    ):
        if os.path.isfile(os.path.join(candidate, "cpu.stat")):
            return candidate
    return None


def read_cgroup(cgroup_root, container_id):
    """(cpu_usage_usec, mem_bytes, mem_limit_bytes) em cgroup v2, ou None."""
    base = cgroup_dir(cgroup_root, container_id)
    if not base:
        return None
    usage = None
    for line in read_text(os.path.join(base, "cpu.stat")).splitlines():
        key, _, value = line.partition(" ")
        if key == "usage_usec":
            usage = int(value)
    current = int(read_text(os.path.join(base, "memory.current")).strip())
    inactive = 0
    try:
        for line in read_text(os.path.join(base, "memory.stat")).splitlines():
            key, _, value = line.partition(" ")
            if key == "inactive_file":
                inactive = int(value)
    except OSError:
        pass
    raw_limit = read_text(os.path.join(base, "memory.max")).strip()
    limit = None if raw_limit == "max" else int(raw_limit)
    # Mesmo cálculo do `docker stats` em cgroup v2: uso - inactive_file.
    return usage, max(0, current - inactive), limit


class ContainerSampler:
    def __init__(self, docker_root, cgroup_root, roles_to_names):
        self.docker_root = docker_root
        self.cgroup_root = cgroup_root
        self.roles_to_names = roles_to_names
        self.prev_cpu = {}  # container_id -> (usage_usec, monotonic_usec)

    def sample(self, cores, now_usec):
        configs = load_containers(self.docker_root)
        result = []
        for role, name in self.roles_to_names.items():
            data = configs.get(name)
            if data is None:
                result.append(missing_container(role, name))
                continue
            state = data.get("State") or {}
            status = docker_state(state)
            running = status in ("running", "paused", "restarting")
            cpu = mem = limit = None
            cid = str(data.get("ID") or "")
            stats = read_cgroup(self.cgroup_root, cid) if running and cid else None
            if stats:
                usage, mem, limit = stats
                prev = self.prev_cpu.get(cid)
                if prev and usage is not None and now_usec > prev[1]:
                    used = (usage - prev[0]) / ((now_usec - prev[1]) * cores) * 100
                    cpu = round(min(100.0, max(0.0, used)), 2)
                if usage is not None:
                    self.prev_cpu[cid] = (usage, now_usec)
            result.append({
                "role": role,
                "name": name,
                "state": status,
                "running": running,
                # O Docker não grava o resultado do healthcheck em config.v2.json (fica "starting"
                # desde o início); sem o socket não há fonte confiável, então não informamos.
                "health": None,
                "startedAt": iso_from_docker(state.get("StartedAt")),
                "restartCount": int(data.get("RestartCount") or 0),
                "oomKilled": bool(state.get("OOMKilled")),
                "cpuPercent": cpu,
                "memBytes": mem,
                "memLimitBytes": limit,
                "image": (data.get("Config") or {}).get("Image"),
            })
        return result


def missing_container(role, name):
    return {
        "role": role, "name": name, "state": "missing", "running": False, "health": None,
        "startedAt": None, "restartCount": 0, "oomKilled": False,
        "cpuPercent": None, "memBytes": None, "memLimitBytes": None, "image": None,
    }


def parse_roles(spec):
    """'api=evolution-api,postgres=evolution-postgres' -> {role: nome}."""
    mapping = {}
    for item in (spec or "").split(","):
        role, _, name = item.strip().partition("=")
        if role in ROLES and name.strip():
            mapping[role] = name.strip()
    return mapping


# ---------------------------------------------------------------------- envio

class Sender:
    def __init__(self, url, token, max_buffer, timeout=10):
        self.url = url
        self.token = token
        self.timeout = timeout
        self.buffer = deque(maxlen=max_buffer)
        self.failing = False

    def push(self, sample):
        self.buffer.append(sample)

    def flush(self):
        while self.buffer:
            batch = list(self.buffer)[:MAX_BATCH]
            status = self.post(batch)
            if status is not None and 200 <= status < 300:
                for _ in batch:
                    self.buffer.popleft()
                if self.failing:
                    log("ingest recovered; buffer=%d" % len(self.buffer))
                self.failing = False
                continue
            if status == 400:
                # Lote recusado pela validação: descartar para não travar a fila.
                log("ingest rejected batch (400); dropped %d sample(s)" % len(batch))
                for _ in batch:
                    self.buffer.popleft()
                continue
            if not self.failing:
                log("ingest failed (status=%s); buffering, size=%d" % (status, len(self.buffer)))
            self.failing = True
            return

    def post(self, batch):
        body = json.dumps({"samples": batch}).encode("utf-8")
        req = urllib.request.Request(self.url, data=body, method="POST", headers={
            "Content-Type": "application/json",
            "Authorization": "Bearer " + self.token,
        })
        try:
            with urllib.request.urlopen(req, timeout=self.timeout) as resp:
                return resp.status
        except urllib.error.HTTPError as err:
            return err.code
        except (urllib.error.URLError, OSError, ValueError):
            return None


# ----------------------------------------------------------------------- loop

class Collector:
    def __init__(self, cfg):
        self.cfg = cfg
        self.containers = ContainerSampler(cfg["docker_root"], cfg["cgroup_root"], cfg["roles"])
        self.prev_host = None

    def sample(self, now_usec):
        total, idle, cores, boot = read_cpu_times(self.cfg["proc_root"])
        cur = (total, idle)
        cpu = cpu_percent(self.prev_host, cur) if self.prev_host else None
        self.prev_host = cur
        containers = self.containers.sample(max(1, cores), now_usec)
        if cpu is None:
            return None  # primeira leitura serve só de base para os deltas de CPU
        host = {"cpuPercent": cpu, "cpuCores": max(1, cores)}
        host.update(read_memory(self.cfg["proc_root"]))
        host.update(read_disk(self.cfg["disk_path"]))
        host.update(read_load(self.cfg["proc_root"]))
        host["bootAt"] = iso_from_dt(datetime.fromtimestamp(boot, timezone.utc))
        return {"source": self.cfg["source"], "collectedAt": iso_now(), "host": host, "containers": containers}


def load_config(env):
    url = env.get("COLLECTOR_INGEST_URL", "").strip()
    token = env.get("COLLECTOR_INGEST_TOKEN", "").strip()
    if not url or len(token) < 32:
        raise SystemExit("COLLECTOR_INGEST_URL e COLLECTOR_INGEST_TOKEN (>= 32) são obrigatórios")
    source = env.get("COLLECTOR_SOURCE", "").strip() or socket.gethostname()
    return {
        "url": url,
        "token": token,
        "source": "".join(c for c in source if c.isalnum() or c in "._-")[:64] or "evolution",
        "roles": parse_roles(env.get("COLLECTOR_CONTAINERS", "")),
        "interval": max(15, int(env.get("COLLECTOR_INTERVAL_SECONDS", "60"))),
        "max_buffer": max(1, int(env.get("COLLECTOR_MAX_BUFFER", "1440"))),
        "disk_path": env.get("COLLECTOR_DISK_PATH", "/"),
        "docker_root": env.get("COLLECTOR_DOCKER_ROOT", "/var/lib/docker"),
        "cgroup_root": env.get("COLLECTOR_CGROUP_ROOT", "/sys/fs/cgroup"),
        "proc_root": env.get("COLLECTOR_PROC_ROOT", "/proc"),
    }


def main():
    cfg = load_config(os.environ)
    collector = Collector(cfg)
    sender = Sender(cfg["url"], cfg["token"], cfg["max_buffer"])
    log("started source=%s interval=%ss containers=%s" % (
        cfg["source"], cfg["interval"], ",".join(sorted(cfg["roles"].values())) or "-"))
    while True:
        started = time.monotonic()
        try:
            sample = collector.sample(int(started * 1_000_000))
            if sample:
                sender.push(sample)
                sender.flush()
        except Exception as err:  # noqa: BLE001 — um ciclo ruim não derruba o serviço
            log("cycle error: %s" % type(err).__name__)
        time.sleep(max(1.0, cfg["interval"] - (time.monotonic() - started)))


if __name__ == "__main__":
    sys.exit(main())
