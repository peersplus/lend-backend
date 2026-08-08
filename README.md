# lend-backend

## Environment Setup (Firebase)

1. Create your local environment file:

```bash
cp .env.example .env
```

2. Fill these Firebase Admin values in `.env`:

```env
FIREBASE_PROJECT_ID=your-project-id
FIREBASE_CLIENT_EMAIL=firebase-adminsdk-xxxxx@your-project-id.iam.gserviceaccount.com
FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
FIREBASE_DATABASE_URL=https://your-project-id-default-rtdb.firebaseio.com
```

3. Where to get them:

- Firebase Console -> Project settings -> Service accounts -> Generate new private key
- Use values from the downloaded service account JSON:
	- `project_id` -> `FIREBASE_PROJECT_ID`
	- `client_email` -> `FIREBASE_CLIENT_EMAIL`
	- `private_key` -> `FIREBASE_PRIVATE_KEY`

4. Important formatting for private key:

- Keep the value in quotes.
- Keep `\n` inside the key exactly as shown.

5. `.env` is already ignored by git, so secrets will not be committed.

6. Run locally:

```bash
npm run build
npm run dev
```

## Firebase Production Setup (App Hosting / Functions)

Use production values for all required env vars from `.env.example`, especially:

```env
MONGODB_URI=
FIREBASE_PROJECT_ID=
FIREBASE_CLIENT_EMAIL=
FIREBASE_PRIVATE_KEY=
FIREBASE_DATABASE_URL=
CORS_ORIGINS=
PUBLIC_API_URL=
PUBLIC_FRONTEND_URL=
WHATSAPP_WEBHOOK_VERIFY_TOKEN=
WHATSAPP_ACCESS_TOKEN=
WHATSAPP_PHONE_NUMBER_ID=
WHATSAPP_APP_SECRET=
```

### App Hosting

1. In Firebase Console, open your App Hosting backend.
2. Add environment variables for the backend runtime.
3. For sensitive values (`FIREBASE_PRIVATE_KEY`, access tokens, SMTP passwords), use Secret Manager-backed values where available.
4. Redeploy after updating env.

### Cloud Functions (if used)

Set runtime env before deploy:

```bash
firebase functions:config:set \
	app.mongo_uri="<MONGODB_URI>" \
	app.firebase_project_id="<FIREBASE_PROJECT_ID>" \
	app.firebase_client_email="<FIREBASE_CLIENT_EMAIL>"
```

For secrets, prefer Secret Manager integrations instead of plain config values.

### Private Key Notes

- Keep `FIREBASE_PRIVATE_KEY` in one line with escaped newlines: `\n`
- If a platform stores multiline values correctly, keep the original PEM format.
- After deployment, validate via:
	- `GET /health`
	- Any authenticated endpoint (to confirm Firebase Admin init)