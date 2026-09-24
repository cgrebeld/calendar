import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
from updater import Updater, validate_manifest, version


def manifest(number):
    return dict(schemaVersion=1, platform="linux/amd64", minimumUpdaterVersion=1, version=f"1.0.{number}",
                webImage=f"ghcr.io/cgrebeld/calendar-web@sha256:{number:064x}",
                apiImage=f"ghcr.io/cgrebeld/calendar-api@sha256:{number:064x}")


class UpdateTest(unittest.TestCase):
    def test_lifecycle_and_failures(self):
        with tempfile.TemporaryDirectory() as directory:
            commands = []
            def run(*args, **kwargs):
                commands.append(args)
                return ""
            updater = Updater("cgrebeld/calendar", directory, "compose.yaml", "calendar.env", run)
            updater.smoke = lambda candidate: None
            launched = []
            updater.launch = lambda candidate: launched.append(candidate["version"])
            for number in (1, 2, 3):
                updater.install(manifest(number))
                self.assertEqual(updater.state["status"], "idle")
                self.assertEqual(updater.state["progress"][-1], {"label": "Update complete", "state": "complete"})
                self.assertEqual(updater.state["active"], manifest(number))
            self.assertEqual(updater.state["previous"], manifest(2))
            self.assertEqual(len(updater.state["images"]), 4)
            self.assertIn(("docker", "image", "rm", manifest(1)["webImage"]), commands)
            self.assertNotIn(("docker", "image", "rm", manifest(2)["webImage"]), commands)
            with self.assertRaises(ValueError):
                updater.install(manifest(2))
            with patch.object(updater, "smoke", side_effect=RuntimeError("bad image")):
                with self.assertRaises(RuntimeError):
                    updater.install(manifest(4))
            self.assertEqual(updater.state["progress"][-1]["state"], "failed")
            self.assertEqual(updater.state["status"], "failed")
            self.assertEqual(updater.state["active"], manifest(3))
            with patch.object(updater, "launch", side_effect=[RuntimeError("bad startup"), None]) as launch:
                with self.assertRaises(RuntimeError):
                    updater.install(manifest(4))
                self.assertEqual([call.args[0] for call in launch.call_args_list], [manifest(4), manifest(3)])
            self.assertEqual(updater.state["status"], "rolled_back")
            self.assertEqual(updater.state["active"], manifest(3))
            with patch.object(updater, "launch", side_effect=RuntimeError("Docker down")):
                with self.assertRaises(RuntimeError):
                    updater.install(manifest(4))
            self.assertEqual(updater.state["status"], "rollback_failed")
            with self.assertRaises(ValueError):
                updater.dispatch("install", "1.0.4")
            updater.recover()
            self.assertEqual(launched[-1], "1.0.3")
            self.assertEqual(updater.state["status"], "rolled_back")
            updater.save(status="installing")
            updater.recover()
            self.assertEqual(updater.state["status"], "failed")
            self.assertEqual(json.loads(Path(directory, "state.json").read_text()), updater.state)

    def test_validation_and_checks(self):
        for invalid in ("1.0", "v1.0.0", "01.0.0", "1.0.0\n", None):
            with self.assertRaises(ValueError):
                version(invalid)
        self.assertGreater(version("1.10.0"), version("1.9.0"))
        for changed in ({"webImage": "ghcr.io/evil/web:latest"}, {"platform": "linux/arm64"}, {"minimumUpdaterVersion": 2}):
            with self.assertRaises(ValueError):
                validate_manifest(manifest(1) | changed, "cgrebeld/calendar")
        with tempfile.TemporaryDirectory() as directory:
            updater = Updater("cgrebeld/calendar", directory, "compose", "env", lambda *args, **kw: "")
            updater.save(active=manifest(1))
            with patch("updater.urlopen") as response:
                response.return_value.__enter__.return_value.read.side_effect = [
                    json.dumps(manifest(2)).encode(),
                    json.dumps({"tag_name": "v1.0.2", "body": "What's new in 1.0.2"}).encode(),
                ]
                updater.check()
                self.assertEqual(updater.state["available"], manifest(2))
                self.assertEqual(updater.state["progress"][-1], {"label": "Check complete", "state": "complete"})
                self.assertEqual(updater.state["notes"], {"version": "1.0.2", "body": "What's new in 1.0.2"})
                response.return_value.__enter__.return_value.read.side_effect = None
                response.return_value.__enter__.return_value.read.return_value = json.dumps(manifest(1)).encode()
                updater.check()
                self.assertIsNone(updater.state["available"])
                self.assertEqual(updater.state["notes"], {"version": "1.0.2", "body": "What's new in 1.0.2"})
            updater.busy = True
            with self.assertRaises(ValueError):
                updater.dispatch("check")
            updater.busy = False
            with self.assertRaises(ValueError):
                updater.dispatch("install", "9.9.9")
            with self.assertRaises(ValueError):
                updater.launch(manifest(1))  # Missing integration health response.
            updater.run = lambda *args, **kw: json.dumps({"version": "1.0.1"})
            updater.launch(manifest(1))
            self.assertIn(manifest(1)["webImage"], Path(directory, "release.env").read_text())
            with self.assertRaises(RuntimeError):
                updater.launch(manifest(2))  # A stale API must fail activation.

    def test_smoke_checks_architecture_labels_and_health(self):
        with tempfile.TemporaryDirectory() as directory:
            def run(*args, **kw):
                if args[1:3] == ("image", "inspect"):
                    component = "web" if "-web@" in args[-1] else "api"
                    return json.dumps([{"Architecture": "amd64", "Os": "linux", "Config": {"Labels": {
                        "io.calendar.component": component, "org.opencontainers.image.version": "1.0.1"}}}])
                return "healthy" if args[1] == "inspect" else ""
            updater = Updater("cgrebeld/calendar", directory, "compose", "env", run)
            updater.smoke(manifest(1))
            with self.assertRaises(ValueError):
                updater.smoke(manifest(2))


if __name__ == "__main__":
    unittest.main()
