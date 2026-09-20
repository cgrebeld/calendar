"""CI: smoke-test the exact images before publishing their digest manifest."""
import json
import os
import subprocess
import time


def run(*args):
    return subprocess.check_output(args, text=True).strip()


def main():
    for component in ("api", "web"):
        container = run("docker", "run", "-d", "--network", "none", f"calendar-{component}:ci")
        try:
            for _ in range(45):
                status = run("docker", "inspect", "--format", "{{.State.Health.Status}}", container)
                if status == "healthy":
                    break
                if status == "unhealthy":
                    raise RuntimeError(f"{component} failed health check")
                time.sleep(2)
            else:
                raise RuntimeError(f"{component} health check timed out")
        finally:
            run("docker", "rm", "-f", container)
    version = os.environ["VERSION"]
    if version == "dev":
        return
    repository = os.environ["REPOSITORY"].lower()
    published = run("gh", "api", "--paginate", f"repos/{repository}/releases", "--jq", ".[].tag_name").splitlines()
    if f"v{version}" in published:
        raise RuntimeError("Release already exists; publish a new version instead")
    manifest = {"schemaVersion": 1, "version": version, "platform": "linux/amd64", "minimumUpdaterVersion": 1}
    for component in ("web", "api"):
        repo = f"ghcr.io/{repository}-{component}"
        tag = f"{repo}:{version}"
        run("docker", "tag", f"calendar-{component}:ci", tag)
        run("docker", "push", tag)
        digests = json.loads(run("docker", "inspect", "--format", "{{json .RepoDigests}}", tag))
        manifest[f"{component}Image"] = next(d for d in digests if d.startswith(repo + "@sha256:"))
    with open("release.json", "w") as output:
        json.dump(manifest, output, indent=2)
    # Refuse to silently replace an existing release or its manifest.
    run("gh", "release", "create", f"v{version}", "release.json", "--verify-tag", "--generate-notes", "--repo", repository)


if __name__ == "__main__":
    main()
