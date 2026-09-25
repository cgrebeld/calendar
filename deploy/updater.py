#!/usr/bin/env python3
"""Debian host updater. Only this root-owned service has access to Docker."""
import argparse
import hashlib
import io
import json
import os
from pathlib import Path
import re
import shutil
import socketserver
import subprocess
import tarfile
import threading
import time
from http.server import BaseHTTPRequestHandler
from urllib.request import Request, urlopen

VERSION = re.compile(r"(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\.(0|[1-9][0-9]*)\Z")
HOST_FILES = ("compose.yaml", "updater.py", "calendar-updater.service", "kiosk-autostart", "hide-cursor.py", "setup-audio.sh")
HOST_PATHS = {name: Path("/opt/calendar") / name for name in HOST_FILES}
HOST_PATHS["calendar-updater.service"] = Path("/etc/systemd/system/calendar-updater.service")
KIOSK_AUTOSTART = Path("/home/kiosk/.config/labwc/autostart")
CURSOR_ENV = Path("/home/kiosk/.config/labwc/environment.d/99-calendar-cursor.env")


def version(value):
    if not isinstance(value, str) or not VERSION.fullmatch(value):
        raise ValueError("Expected a stable X.Y.Z release version")
    return tuple(map(int, value.split(".")))


def validate_manifest(data, repository):
    if not isinstance(data, dict) or data.get("schemaVersion") != 1 or data.get("platform") != "linux/amd64" or data.get("minimumUpdaterVersion") != 2:
        raise ValueError("Unsupported release manifest")
    version(data.get("version"))
    if not isinstance(data.get("hostFilesSha256"), str) or not re.fullmatch(r"[a-f0-9]{64}", data["hostFilesSha256"]):
        raise ValueError("Invalid host files digest")
    for component in ("web", "api"):
        prefix = f"ghcr.io/{repository}-{component}@sha256:"
        image = data.get(f"{component}Image", "")
        if not isinstance(image, str) or not re.fullmatch(re.escape(prefix) + r"[a-f0-9]{64}", image):
            raise ValueError("Release image is not a pinned digest in the configured repository")
    return {key: data[key] for key in ("schemaVersion", "platform", "minimumUpdaterVersion", "version", "webImage", "apiImage", "hostFilesSha256")}


def atomic_json(path, value):
    temporary = path.with_suffix(".tmp")
    with temporary.open("w") as output:
        json.dump(value, output, indent=2)
        output.flush()
        os.fsync(output.fileno())
    os.replace(temporary, path)
    fd = os.open(path.parent, os.O_RDONLY)
    try:
        os.fsync(fd)
    finally:
        os.close(fd)


def command(*args, timeout=600):
    result = subprocess.run(args, capture_output=True, text=True, timeout=timeout)
    if result.returncode:
        raise RuntimeError(f"{args[0]} {args[1]} failed: {result.stderr[-1000:]}")
    return result.stdout.strip()


class Updater:
    def __init__(self, repository, state_dir, compose, environment, run=command):
        if not re.fullmatch(r"[a-z0-9][a-z0-9_.-]*/[a-z0-9][a-z0-9_.-]*", repository):
            raise ValueError("Invalid GitHub repository")
        self.repository, self.directory = repository, Path(state_dir)
        self.directory.mkdir(parents=True, exist_ok=True)
        self.path = self.directory / "state.json"
        self.compose, self.environment, self.run = str(compose), str(environment), run
        self.lock = threading.RLock()
        self.busy = False
        self.state = json.loads(self.path.read_text()) if self.path.exists() else {
            "status": "idle", "active": None, "previous": None, "available": None, "notes": None, "images": [],
        }

    def save(self, **values):
        with self.lock:
            self.state.update(values)
            atomic_json(self.path, self.state)

    def start_progress(self, label):
        self.save(progress=[{"label": label, "state": "running"}])

    def advance_progress(self, label):
        with self.lock:
            progress = [dict(step) for step in self.state.get("progress", [])]
            if progress and progress[-1]["state"] == "running":
                progress[-1]["state"] = "complete"
            progress.append({"label": label, "state": "running"})
            self.save(progress=progress)

    def finish_progress(self, label=None):
        with self.lock:
            progress = [dict(step) for step in self.state.get("progress", [])]
            if progress and progress[-1]["state"] == "running":
                progress[-1]["state"] = "complete"
            if label:
                progress.append({"label": label, "state": "complete"})
            self.save(progress=progress)

    def fail_progress(self):
        with self.lock:
            progress = [dict(step) for step in self.state.get("progress", [])]
            if progress and progress[-1]["state"] == "running":
                progress[-1]["state"] = "failed"
            self.save(progress=progress)

    def public(self):
        with self.lock:
            return {"enabled": True, "status": self.state["status"], "busy": self.busy,
                    "currentVersion": (self.state.get("active") or {}).get("version"),
                    "availableVersion": (self.state.get("available") or {}).get("version"),
                    "lastChecked": self.state.get("lastChecked"), "message": self.state.get("message"),
                    "progress": self.state.get("progress", []),
                    "releaseNotes": self.state.get("notes")}

    def fetch_notes(self):
        try:
            url = f"https://api.github.com/repos/{self.repository}/releases/latest"
            with urlopen(Request(url, headers={"User-Agent": "calendar-updater/1", "Accept": "application/vnd.github+json"}), timeout=20) as response:
                raw = response.read(65537)
            if len(raw) > 65536:
                raise ValueError("Release notes too large")
            data = json.loads(raw)
            body, tag = data.get("body"), data.get("tag_name")
            if not isinstance(body, str) or not isinstance(tag, str):
                raise ValueError("Invalid release notes response")
            return {"version": tag.lstrip("v"), "body": body.strip()[:4000]}
        except Exception:
            return self.state.get("notes")

    def check(self):
        url = f"https://github.com/{self.repository}/releases/latest/download/release.json"
        with urlopen(Request(url, headers={"User-Agent": "calendar-updater/1"}), timeout=20) as response:
            raw = response.read(16385)
        if len(raw) > 16384:
            raise ValueError("Release manifest too large")
        self.advance_progress("Validating release manifest")
        candidate = validate_manifest(json.loads(raw), self.repository)
        active = self.state.get("active")
        available = candidate if active and version(candidate["version"]) > version(active["version"]) else None
        notes = self.fetch_notes() if available else self.state.get("notes")
        self.finish_progress("Check complete")
        self.save(status="idle", available=available, notes=notes, lastChecked=time.time(),
                  message=f'Version {candidate["version"]} is available.' if available else "No new release available.")

    def release_env(self, manifest):
        target = self.directory / "release.env"
        temporary = target.with_suffix(".tmp")
        with temporary.open("w") as output:
            output.write(f'WEB_IMAGE={manifest["webImage"]}\nAPI_IMAGE={manifest["apiImage"]}\n')
            output.flush()
            os.fsync(output.fileno())
        os.replace(temporary, target)

    def launch(self, manifest):
        self.release_env(manifest)
        self.run("docker", "compose", "--project-name", "calendar-wall", "--env-file", self.environment,
                 "--env-file", str(self.directory / "release.env"), "-f", self.compose,
                 "up", "-d", "--wait", "--wait-timeout", "120", "--pull", "never", timeout=180)
        self.advance_progress("Verifying web/API version")
        health = self.run("docker", "compose", "--project-name", "calendar-wall", "--env-file", self.environment,
                         "--env-file", str(self.directory / "release.env"), "-f", self.compose,
                         "exec", "-T", "calendar-web", "wget", "-qO-", "http://127.0.0.1/api/health", timeout=20)
        if json.loads(health).get("version") != manifest["version"]:
            raise RuntimeError("Web/API integration health check did not return the expected version")

    def smoke(self, manifest):
        for component in ("web", "api"):
            ref = manifest[f"{component}Image"]
            details = json.loads(self.run("docker", "image", "inspect", ref))[0]
            labels = details["Config"].get("Labels") or {}
            if details.get("Architecture") != "amd64" or details.get("Os") != "linux" or labels.get("io.calendar.component") != component or labels.get("org.opencontainers.image.version") != manifest["version"]:
                raise ValueError("Image architecture, component or version does not match the release")
            self.advance_progress(f"Health-checking {component} image")
            # Isolated smoke test: no production data, credentials, ports, or updater socket.
            name = f"calendar-update-test-{component}"
            self.run("docker", "run", "-d", "--name", name, "--label", "io.calendar.update-test=true", "--network", "none", ref)
            try:
                for _ in range(45):
                    health = self.run("docker", "inspect", "--format", "{{.State.Health.Status}}", name)
                    if health == "healthy":
                        break
                    if health == "unhealthy":
                        raise RuntimeError(f"{component} failed its health check")
                    time.sleep(2)
                else:
                    raise RuntimeError(f"{component} health check timed out")
            finally:
                self.run("docker", "rm", "-f", name)
            if component == "web":
                self.advance_progress("Verifying API image")

    def host_files(self, manifest):
        url = f'https://github.com/{self.repository}/releases/download/v{manifest["version"]}/host-files.tar'
        with urlopen(Request(url, headers={"User-Agent": "calendar-updater/2"}), timeout=30) as response:
            archive = response.read(1048577)
        if len(archive) > 1048576 or hashlib.sha256(archive).hexdigest() != manifest["hostFilesSha256"]:
            raise ValueError("Host files archive failed validation")
        with tarfile.open(fileobj=io.BytesIO(archive)) as tar:
            members = tar.getmembers()
            if {m.name for m in members} != set(HOST_FILES) or len(members) != len(HOST_FILES) or any(not m.isfile() or m.size > 262144 for m in members):
                raise ValueError("Unexpected host files archive contents")
            return {m.name: tar.extractfile(m).read() for m in members}

    def replace_host_files(self, files):
        for name, data in files.items():
            target = HOST_PATHS[name]
            target.parent.mkdir(parents=True, exist_ok=True)
            temporary = target.with_name(target.name + ".tmp")
            temporary.write_bytes(data)
            temporary.chmod(0o755 if name.endswith((".py", ".sh")) or name == "kiosk-autostart" else 0o644)
            os.replace(temporary, target)
        if "kiosk-autostart" in files and KIOSK_AUTOSTART.exists():
            KIOSK_AUTOSTART.write_bytes(files["kiosk-autostart"])
        if "hide-cursor.py" in files and CURSOR_ENV.exists():
            self.run("runuser", "-u", "kiosk", "--", "python3", str(HOST_PATHS["hide-cursor.py"]))
        self.run("systemctl", "daemon-reload")

    def restart_service(self):
        if subprocess.run(["systemctl", "is-active", "--quiet", "calendar-updater.service"], capture_output=True).returncode == 0:
            self.run("systemd-run", "--on-active=2s", "/usr/bin/systemctl", "restart", "calendar-updater.service")

    def install(self, candidate):
        candidate = validate_manifest(candidate, self.repository)
        previous = self.state.get("active")
        if previous and version(candidate["version"]) <= version(previous["version"]):
            raise ValueError("Refusing a downgrade or reinstall")
        refs = [candidate["webImage"], candidate["apiImage"]]
        backup = self.directory / "host-backup"
        self.start_progress("Downloading web image")
        self.save(status="installing", message="Downloading and checking update…", images=list(dict.fromkeys(self.state.get("images", []) + refs)))
        try:
            self.run("docker", "pull", "--platform", "linux/amd64", refs[0])
            self.advance_progress("Downloading API image")
            self.run("docker", "pull", "--platform", "linux/amd64", refs[1])
            self.advance_progress("Verifying web image")
            self.smoke(candidate)
            files = self.host_files(candidate)
            backup.mkdir(exist_ok=True)
            for name in HOST_FILES:
                target = HOST_PATHS[name]
                if target.exists():
                    shutil.copy2(target, backup / name)
            (backup / "absent.json").write_text(json.dumps([name for name in HOST_FILES if not (backup / name).exists()]))
            if KIOSK_AUTOSTART.exists():
                shutil.copy2(KIOSK_AUTOSTART, backup / "active-kiosk-autostart")
            self.advance_progress("Installing host files")
            self.save(status="activating", message="Installing host files and restarting app…")
            self.replace_host_files(files)
            # A passing smoke test is the go-ahead to restart immediately; no manual step in between.
            self.advance_progress("Starting containers and waiting for health")
            self.save(message="Restarting app and checking health…")
            self.launch(candidate)
            self.restart_service()
        except Exception:
            self.fail_progress()
            if backup.exists() and self.state["status"] != "activating":
                shutil.rmtree(backup)
            if self.state["status"] == "activating" and previous:
                try:
                    self.advance_progress("Restoring previous release")
                    self.restore_host_files(backup)
                    self.launch(previous)
                except Exception:
                    self.fail_progress()
                    self.save(status="rollback_failed", message="Restart and rollback failed. Host administrator attention required.")
                    raise
                self.finish_progress("Previous release restored")
                self.save(status="rolled_back", message="Update failed. Previous release restored.")
            elif self.state["status"] == "activating":
                self.restore_host_files(backup)
                self.save(status="failed", message="Initial startup failed; no previous release exists.")
            else:
                self.save(status="failed", message="Installation failed. The current release is unchanged.")
            raise
        else:
            self.finish_progress("Update complete")
            self.save(status="idle", active=candidate, previous=previous, available=None, message="Update complete.")
            shutil.rmtree(backup, ignore_errors=True)
        finally:
            self.cleanup()

    def cleanup(self):
        keep = {m[key] for m in (self.state.get(k) for k in ("active", "previous")) if m for key in ("webImage", "apiImage")}
        remaining = []
        for ref in self.state.get("images", []):
            # Only refs recorded by this updater; never prune Docker or delete volumes.
            if ref in keep:
                remaining.append(ref)
                continue
            try:
                self.run("docker", "image", "rm", ref, timeout=30)
            except Exception:
                remaining.append(ref)  # In-use images are retained and retried later.
        self.save(images=remaining)

    def restore_host_files(self, backup):
        if backup.exists():
            self.replace_host_files({name: (backup / name).read_bytes() for name in HOST_FILES if (backup / name).exists()})
            if (backup / "absent.json").exists():
                for name in json.loads((backup / "absent.json").read_text()):
                    HOST_PATHS[name].unlink(missing_ok=True)
            if (backup / "active-kiosk-autostart").exists():
                KIOSK_AUTOSTART.write_bytes((backup / "active-kiosk-autostart").read_bytes())
            shutil.rmtree(backup)

    def recover(self):
        # Only remove our labelled temporary containers left by an interrupted test.
        ids = self.run("docker", "ps", "-aq", "--filter", "label=io.calendar.update-test=true").split()
        for container in ids:
            self.run("docker", "rm", "-f", container)
        if self.state["status"] in ("activating", "rollback_failed") and self.state.get("active"):
            self.restore_host_files(self.directory / "host-backup")
            self.launch(self.state["active"])
            self.save(status="rolled_back", message="Interrupted update recovered to the last confirmed release.")
        elif self.state["status"] == "activating":
            self.restore_host_files(self.directory / "host-backup")
            self.save(status="failed", message="Interrupted initial activation discarded.")
        elif self.state["status"] == "installing":
            shutil.rmtree(self.directory / "host-backup", ignore_errors=True)
            self.save(status="failed", message="Interrupted installation discarded. Current release unchanged.")
        self.cleanup()

    def dispatch(self, action, requested=None):
        with self.lock:
            if self.busy:
                raise ValueError("Another update operation is running")
            if self.state["status"] == "rollback_failed" and action != "check":
                raise ValueError("Host administrator must recover the failed rollback first")
            if action == "install":
                candidate = self.state.get("available")
                if not candidate or candidate["version"] != requested:
                    raise ValueError("This release is no longer the offered update")
                work = lambda: self.install(candidate)
            elif action == "check":
                work = self.check
            else:
                raise ValueError("Unknown update action")
            self.busy = True
            first = {"check": "Fetching release manifest", "install": "Downloading web image"}[action]
            self.save(status={"check": "checking", "install": "installing"}[action],
                      message=None, progress=[{"label": first, "state": "running"}])

        def worker():
            try:
                work()
            except Exception as error:
                print(f"Update {action}: {error}", flush=True)
                if action == "check":
                    self.fail_progress()
                    self.save(status="check_failed", message="Release check unavailable. Current app is unaffected.")
            finally:
                with self.lock:
                    self.busy = False
        threading.Thread(target=worker, daemon=True).start()


def serve(updater, socket_path):
    class Handler(BaseHTTPRequestHandler):
        def do_GET(self):
            if self.path != "/status":
                return self.send_error(404)
            self.reply(200, updater.public())

        def do_POST(self):
            try:
                length = int(self.headers.get("Content-Length", "0"))
                if not 0 < length <= 1024:
                    raise ValueError("Invalid request size")
                body = json.loads(self.rfile.read(length))
                updater.dispatch(self.path.removeprefix("/"), body.get("version"))
                self.reply(202, updater.public())
            except (ValueError, AttributeError) as error:
                self.reply(409, {"error": str(error)})

        def reply(self, status, body):
            data = json.dumps(body).encode()
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(data)))
            self.end_headers()
            self.wfile.write(data)

        def log_message(self, *_):
            pass

    class Server(socketserver.ThreadingMixIn, socketserver.UnixStreamServer):
        daemon_threads = True

    path = Path(socket_path)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.unlink(missing_ok=True)
    with Server(str(path), Handler) as server:
        os.chmod(path, 0o600)
        def poll():
            while True:
                try:
                    updater.dispatch("check")
                except ValueError:
                    pass
                time.sleep(6 * 3600)
        threading.Thread(target=poll, daemon=True).start()
        server.serve_forever()


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--initialize", help="Local release.json for initial installation")
    args = parser.parse_args()
    updater = Updater("cgrebeld/calendar", "/var/lib/calendar-updater", "/opt/calendar/compose.yaml", "/etc/calendar/calendar.env")
    updater.recover()
    if args.initialize:
        if updater.state.get("active"):
            raise SystemExit("Already initialized; use the in-app update flow")
        updater.install(json.loads(Path(args.initialize).read_text()))
    else:
        serve(updater, "/run/calendar-updater/control.sock")
