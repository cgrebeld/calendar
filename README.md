# Calendar Display

## Run

```sh
docker compose up --build
```

Open <http://localhost:8080>.

Generate the CycloneDX SBOM:

```sh
cd app
npm run --silent sbom > sbom.cdx.json
```

For Docker installations without Compose:

```sh
docker build -t calendar-display .
docker run --rm -p 8080:80 calendar-display
```
