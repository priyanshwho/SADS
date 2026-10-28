# The Good Letter

This is an additional implementation inspired by the newsletter scenario in Assignment I. It is a small signup demo: it saves subscriptions locally and does not send email.

## Run

Requires Node.js 22.13 or newer. There are no dependencies to install and no build step.

```sh
npm start
```

Open <http://127.0.0.1:3000>. Run the API tests with:

```sh
npm test
```

The server uses `HOST=127.0.0.1` and `PORT=3000` by default. Set either environment variable to change the bind address or port. SQLite data is stored at `DATA_PATH`, which defaults to `data/subscriptions.sqlite` in the project directory.

## Signup behavior

Email is required and consent to receive the letter by email must be checked. Interest selections are optional: `giving`, `reuse`, and `community`. Email addresses are trimmed and lowercased before storage. A duplicate normalized email receives the same success response and keeps the interests from its original signup.

The signup endpoint is `POST /api/subscriptions` and accepts JSON:

```sh
curl -X POST http://127.0.0.1:3000/api/subscriptions \
  -H 'Content-Type: application/json' \
  -d '{"email":"reader@example.com","consent":true,"interests":["reuse"]}'
```

Successful requests return `200` with `{"message":"Your subscription is saved."}`. The health endpoint is `GET /api/health`.

This demo only saves signup data; it does not send mail. A production service needs confirmed opt-in, an email provider integration, unsubscribe and deletion flows, and abuse controls.

## Assignment materials

`docs/` contains an AI-assisted assignment draft. The candidate must verify it before use. Candidate contact details and the one-page resume were supplied by Priyanshu Anand. The resume contact details match the corrected candidate table.

## Review the deliverables

- `docs/assignment-answers-draft.pdf` contains the four-page answer draft.
- `docs/assignment-answers.html` is the editable source.
- `docs/fundraisers-schema.sql` is the proposed database design, separate from the newsletter app.
- `artifacts/` contains screenshots from UI checks and print-layout inspection.

The named PDF is `docs/6659 - Priyanshu Anand - FirstAssignment - ProductEngineer.pdf`, following the source assignment naming convention. The source and `assignment-answers-draft.pdf` contain the same updated details. The supplied resume, with its visible content preserved and optional PDF metadata removed, is included as `docs/6659 - Priyanshu Anand - Resume - ProductEngineer.pdf`. See `docs/assignment-cross-check.md` for requirement coverage and remaining limitations.

## Optional browser and PDF checks

The application itself needs no packages. These maintenance scripts need Playwright and Chromium:

```sh
npm install --no-save --package-lock=false playwright
npx playwright install chromium
node scripts/verify-ui.cjs
node scripts/render-pdf.cjs
```

You can use an existing installation with `PLAYWRIGHT_MODULE` set to the module directory and `CHROME_PATH` set to the browser executable. UI checks use temporary signup data and test four widths, validation, consent, success, network failure, and retry. The PDF script writes the draft and captures each page for inspection.

## Live deployment

The demo is deployed at <https://kapi.priyanshu.cv/letter/> through the existing Caddy site for Priyanshu's domain. A dedicated new subdomain requires DNS access to the `priyanshu.cv` zone; the available Cloudflare credentials do not cover that zone.

- App service: `good-letter.service`, enabled at startup and restarted on failure.
- Installed application: `/opt/good-letter`, with source copied from `server.mjs` and `public/`.
- Local upstream: `127.0.0.1:3097`.
- Persistent database: `/var/lib/good-letter/subscriptions.sqlite`, private to the service.
- Caddy route: `/letter/*` in `/etc/caddy/sites-enabled/kapi.priyanshu.cv.caddy`.
- Reference configuration: `deploy/good-letter.service` and `deploy/kapi-letter-route.caddy`.

For updates, copy the changed server and public files into `/opt/good-letter` and restart `good-letter.service`. The database stays outside the application directory. Inspect service logs with `sudo journalctl -u good-letter.service`. Caddy's full configuration validation requires the same environment file as its service because another existing site uses environment-based authentication.

Only the application is deployed. Assignment documents and repository files are not served by the app.
