"""Testes do coletor: python3 -m unittest -v (nesta pasta)."""

import json
import os
import tempfile
import threading
import unittest
from http.server import BaseHTTPRequestHandler, HTTPServer

import evolution_metrics_collector as c

API_ID = "a" * 64
PG_ID = "b" * 64


def write(path, content):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, "w", encoding="utf-8") as fh:
        fh.write(content)


class Fixture:
    """Árvore fake de /proc, cgroup v2 e /var/lib/docker."""

    def __init__(self):
        self.tmp = tempfile.TemporaryDirectory()
        root = self.tmp.name
        self.proc = os.path.join(root, "proc")
        self.cgroup = os.path.join(root, "cgroup")
        self.docker = os.path.join(root, "docker")
        self.set_cpu(user=100, idle=900)
        write(os.path.join(self.proc, "meminfo"),
              "MemTotal:        8000000 kB\nMemFree:  1000000 kB\nMemAvailable:    6000000 kB\n")
        write(os.path.join(self.proc, "loadavg"), "0.52 0.40 0.31 1/300 12345\n")
        self.container(API_ID, "evolution-api", running=True, restarts=2,
                       started="2026-10-19T11:00:04.490207812Z", image="evoapicloud/evolution-api:v2.3.7")
        self.container(PG_ID, "evolution-postgres", running=False, restarts=0,
                       started="2026-10-19T11:00:04.4Z", health="unhealthy", image="postgres:15")
        self.cgroup_stats(API_ID, usage_usec=1_000_000, current=300 * 1024 * 1024, inactive=100 * 1024 * 1024)

    def set_cpu(self, user, idle):
        write(os.path.join(self.proc, "stat"),
              "cpu  %d 0 0 %d 0 0 0 0 0 0\ncpu0 1 0 0 1 0 0 0 0 0 0\ncpu1 1 0 0 1 0 0 0 0 0 0\n"
              "btime 1760871600\n" % (user, idle))

    def container(self, cid, name, running, restarts, started, image, health=None):
        state = {"Running": running, "Paused": False, "Restarting": False, "Dead": False,
                 "StartedAt": started, "OOMKilled": False}
        if health:
            state["Health"] = {"Status": health}
        write(os.path.join(self.docker, "containers", cid, "config.v2.json"), json.dumps({
            "ID": cid, "Name": "/" + name, "State": state, "RestartCount": restarts,
            "Config": {"Image": image}, "SecretEnv": ["NAO_DEVE_SAIR=1"],
        }))

    def cgroup_stats(self, cid, usage_usec, current, inactive, limit="max"):
        base = os.path.join(self.cgroup, "system.slice", "docker-%s.scope" % cid)
        write(os.path.join(base, "cpu.stat"), "usage_usec %d\nuser_usec 1\nsystem_usec 1\n" % usage_usec)
        write(os.path.join(base, "memory.current"), "%d\n" % current)
        write(os.path.join(base, "memory.stat"), "anon 1\ninactive_file %d\n" % inactive)
        write(os.path.join(base, "memory.max"), "%s\n" % limit)

    def cfg(self):
        return {
            "source": "vps-evo", "proc_root": self.proc, "cgroup_root": self.cgroup,
            "docker_root": self.docker, "disk_path": self.tmp.name,
            "roles": {"api": "evolution-api", "postgres": "evolution-postgres", "redis": "evolution-redis"},
        }


class CollectorTest(unittest.TestCase):
    def setUp(self):
        self.fx = Fixture()

    def tearDown(self):
        self.fx.tmp.cleanup()

    def two_samples(self):
        col = c.Collector(self.fx.cfg())
        self.assertIsNone(col.sample(0))  # primeira leitura = base dos deltas
        self.fx.set_cpu(user=400, idle=1600)  # +300 ocupado / +1000 total = 30%
        # API: +60s de CPU em 60s de relógio com 2 núcleos = 50% da VPS
        self.fx.cgroup_stats(API_ID, usage_usec=61_000_000, current=300 * 1024 * 1024,
                             inactive=100 * 1024 * 1024, limit="1073741824")
        return col.sample(60_000_000)

    def test_host_cpu_ram_disco_load_boot(self):
        sample = self.two_samples()
        host = sample["host"]
        self.assertEqual(host["cpuPercent"], 30.0)
        self.assertEqual(host["cpuCores"], 2)
        self.assertEqual(host["memTotalBytes"], 8000000 * 1024)
        self.assertEqual(host["memAvailableBytes"], 6000000 * 1024)
        self.assertEqual(host["memUsedBytes"], 2000000 * 1024)
        self.assertGreater(host["diskTotalBytes"], 0)
        self.assertLessEqual(host["diskUsedBytes"], host["diskTotalBytes"])
        self.assertEqual((host["load1"], host["load5"], host["load15"]), (0.52, 0.40, 0.31))
        self.assertEqual(host["bootAt"], "2025-10-19T11:00:00.000Z")
        self.assertEqual(sample["source"], "vps-evo")

    def test_conteineres_estado_uptime_reinicios_consumo(self):
        sample = self.two_samples()
        by_role = {item["role"]: item for item in sample["containers"]}
        api = by_role["api"]
        self.assertEqual(api["state"], "running")
        self.assertTrue(api["running"])
        self.assertEqual(api["startedAt"], "2026-10-19T11:00:04.490Z")
        self.assertEqual(api["restartCount"], 2)
        self.assertEqual(api["cpuPercent"], 50.0)
        self.assertEqual(api["memBytes"], 200 * 1024 * 1024)  # current - inactive_file
        self.assertEqual(api["memLimitBytes"], 1073741824)
        self.assertEqual(api["image"], "evoapicloud/evolution-api:v2.3.7")

        pg = by_role["postgres"]
        self.assertEqual(pg["state"], "exited")
        self.assertFalse(pg["running"])
        self.assertIsNone(pg["health"])  # health em disco não é confiável
        self.assertIsNone(pg["cpuPercent"])
        self.assertIsNone(pg["memBytes"])

        self.assertEqual(by_role["redis"]["state"], "missing")
        self.assertNotIn("NAO_DEVE_SAIR", json.dumps(sample))

    def test_iso_from_docker(self):
        self.assertEqual(c.iso_from_docker("2026-10-19T11:00:04.490207812Z"), "2026-10-19T11:00:04.490Z")
        self.assertEqual(c.iso_from_docker("2026-10-19T11:00:04Z"), "2026-10-19T11:00:04.000Z")
        self.assertIsNone(c.iso_from_docker("0001-01-01T00:00:00Z"))
        self.assertIsNone(c.iso_from_docker(""))

    def test_parse_roles_ignora_papel_desconhecido(self):
        self.assertEqual(c.parse_roles("api=evo-api, redis=evo-redis,docker=x,postgres="),
                         {"api": "evo-api", "redis": "evo-redis"})

    def test_config_exige_token_forte(self):
        with self.assertRaises(SystemExit):
            c.load_config({"COLLECTOR_INGEST_URL": "http://127.0.0.1", "COLLECTOR_INGEST_TOKEN": "curto"})


class Handler(BaseHTTPRequestHandler):
    statuses = []
    received = []

    def do_POST(self):
        body = self.rfile.read(int(self.headers["Content-Length"]))
        Handler.received.append((self.headers.get("Authorization"), json.loads(body)))
        status = Handler.statuses.pop(0) if Handler.statuses else 202
        self.send_response(status)
        self.end_headers()

    def log_message(self, *args):
        pass


class SenderTest(unittest.TestCase):
    def setUp(self):
        Handler.statuses = []
        Handler.received = []
        self.server = HTTPServer(("127.0.0.1", 0), Handler)
        threading.Thread(target=self.server.serve_forever, daemon=True).start()
        self.url = "http://127.0.0.1:%d/system/evolution-metrics" % self.server.server_port

    def tearDown(self):
        self.server.shutdown()
        self.server.server_close()

    def test_envia_com_bearer(self):
        sender = c.Sender(self.url, "t" * 32, 10)
        sender.push({"n": 1})
        sender.flush()
        self.assertEqual(len(sender.buffer), 0)
        self.assertEqual(Handler.received[0], ("Bearer " + "t" * 32, {"samples": [{"n": 1}]}))

    def test_falha_temporaria_mantem_buffer_e_reenvia(self):
        Handler.statuses = [503]
        sender = c.Sender(self.url, "t" * 32, 10)
        sender.push({"n": 1})
        sender.flush()
        self.assertEqual(len(sender.buffer), 1)
        sender.push({"n": 2})
        sender.flush()
        self.assertEqual(len(sender.buffer), 0)
        self.assertEqual(Handler.received[-1][1], {"samples": [{"n": 1}, {"n": 2}]})

    def test_backend_fora_do_ar_e_buffer_limitado(self):
        sender = c.Sender("http://127.0.0.1:9/x", "t" * 32, 3, timeout=1)
        for n in range(5):
            sender.push({"n": n})
            sender.flush()
        self.assertEqual([s["n"] for s in sender.buffer], [2, 3, 4])

    def test_lote_invalido_descartado(self):
        Handler.statuses = [400]
        sender = c.Sender(self.url, "t" * 32, 10)
        sender.push({"n": 1})
        sender.flush()
        self.assertEqual(len(sender.buffer), 0)


if __name__ == "__main__":
    unittest.main()
