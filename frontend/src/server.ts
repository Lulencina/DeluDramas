import { APP_BASE_HREF } from '@angular/common';
import { CommonEngine, isMainModule } from '@angular/ssr/node';
import cors from 'cors';
import express, { type NextFunction, type Request, type Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt, { type JwtPayload } from 'jsonwebtoken';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import bootstrap from './main.server';

interface DramaBucket {
  watchedLiked: string[];
  watchedDisliked: string[];
  watching: string[];
  wishlist: string[];
  unfinished: string[];
  opinions: string[];
}

interface ArtistItem {
  name: string;
  favoriteMusic: string;
  review: string;
  photoUrl: string;
}

interface TrackerState {
  kdramas: DramaBucket;
  artists: ArtistItem[];
  asian: {
    dramas: DramaBucket;
    artists: ArtistItem[];
  };
}

interface DbUser {
  id: string;
  username: string;
  email: string;
  passwordHash: string;
}

interface DbState {
  users: DbUser[];
  trackers: Record<string, TrackerState>;
}

interface AuthRequest extends Request {
  userId?: string;
  username?: string;
}

const serverDistFolder = dirname(fileURLToPath(import.meta.url));
const browserDistFolder = resolve(serverDistFolder, '../browser');
const indexHtml = join(serverDistFolder, 'index.server.html');
const dataFolder = resolve(process.cwd(), 'data');
const dbPath = join(dataFolder, 'deludramas.json');
const jwtSecret = process.env['JWT_SECRET'] ?? 'deludramas-dev-secret-change-me';

const app = express();
const commonEngine = new CommonEngine();
app.use(
  cors({
    origin: ['http://localhost:4200', 'http://127.0.0.1:4200', 'http://localhost:4000'],
    methods: ['GET', 'POST', 'PUT', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
  })
);
app.use(express.json({ limit: '1mb' }));

const createDramaBucket = (): DramaBucket => ({
  watchedLiked: [],
  watchedDisliked: [],
  watching: [],
  wishlist: [],
  unfinished: [],
  opinions: []
});

const createDefaultTracker = (): TrackerState => ({
  kdramas: createDramaBucket(),
  artists: [],
  asian: {
    dramas: createDramaBucket(),
    artists: []
  }
});

const emptyDb = (): DbState => ({
  users: [],
  trackers: {}
});

const stringArray = (value: unknown): string[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === 'string').map((item) => item.trim()).filter(Boolean);
};

const sanitizeArtists = (value: unknown): ArtistItem[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .filter((item): item is Record<string, unknown> => !!item && typeof item === 'object')
    .map((item) => ({
      name: typeof item['name'] === 'string' ? item['name'].trim() : '',
      favoriteMusic: typeof item['favoriteMusic'] === 'string' ? item['favoriteMusic'].trim() : '',
      review: typeof item['review'] === 'string' ? item['review'].trim() : '',
      photoUrl: typeof item['photoUrl'] === 'string' ? item['photoUrl'].trim() : ''
    }))
    .filter((item) => item.name && item.favoriteMusic && item.review && item.photoUrl);
};

const sanitizeDramaBucket = (value: unknown): DramaBucket => {
  const base = createDramaBucket();
  if (!value || typeof value !== 'object') {
    return base;
  }
  const input = value as Record<string, unknown>;
  return {
    watchedLiked: stringArray(input['watchedLiked']),
    watchedDisliked: stringArray(input['watchedDisliked']),
    watching: stringArray(input['watching']),
    wishlist: stringArray(input['wishlist']),
    unfinished: stringArray(input['unfinished']),
    opinions: stringArray(input['opinions'])
  };
};

const sanitizeTracker = (value: unknown): TrackerState => {
  const fallback = createDefaultTracker();
  if (!value || typeof value !== 'object') {
    return fallback;
  }
  const input = value as Record<string, unknown>;
  const kdramas = sanitizeDramaBucket(input['kdramas']);
  const artists = sanitizeArtists(input['artists']);

  const asianInput = input['asian'];
  let asianDramas = createDramaBucket();
  let asianArtists: ArtistItem[] = [];

  if (asianInput && typeof asianInput === 'object') {
    const asianObj = asianInput as Record<string, unknown>;
    asianDramas = sanitizeDramaBucket(asianObj['dramas']);
    asianArtists = sanitizeArtists(asianObj['artists']);
  }

  return {
    kdramas,
    artists,
    asian: {
      dramas: asianDramas,
      artists: asianArtists
    }
  };
};

const loadDb = async (): Promise<DbState> => {
  await mkdir(dataFolder, { recursive: true });
  if (!existsSync(dbPath)) {
    const seed = emptyDb();
    await writeFile(dbPath, JSON.stringify(seed, null, 2), 'utf-8');
    return seed;
  }

  const raw = await readFile(dbPath, 'utf-8');
  if (!raw.trim()) {
    return emptyDb();
  }

  const parsed = JSON.parse(raw) as Partial<DbState>;
  return {
    users: Array.isArray(parsed.users) ? parsed.users : [],
    trackers: parsed.trackers && typeof parsed.trackers === 'object' ? parsed.trackers : {}
  };
};

const saveDb = async (state: DbState): Promise<void> => {
  await mkdir(dataFolder, { recursive: true });
  await writeFile(dbPath, JSON.stringify(state, null, 2), 'utf-8');
};

const signToken = (user: DbUser): string =>
  jwt.sign({ sub: user.id, username: user.username }, jwtSecret, {
    expiresIn: '7d'
  });

const authenticate = (req: AuthRequest, res: Response, next: NextFunction): void => {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ message: 'Token no enviado' });
    return;
  }

  const token = authHeader.slice('Bearer '.length);

  try {
    const payload = jwt.verify(token, jwtSecret) as JwtPayload;
    if (!payload.sub || typeof payload.sub !== 'string') {
      res.status(401).json({ message: 'Token invalido' });
      return;
    }

    req.userId = payload.sub;
    req.username = typeof payload['username'] === 'string' ? payload['username'] : '';
    next();
  } catch {
    res.status(401).json({ message: 'Token expirado o invalido' });
  }
};

app.post('/api/auth/register', async (req: Request, res: Response) => {
  const { username, email, password } = req.body as {
    username?: string;
    email?: string;
    password?: string;
  };

  const cleanUsername = username?.trim() ?? '';
  const cleanEmail = email?.trim().toLowerCase() ?? '';
  const cleanPassword = password?.trim() ?? '';

  if (!cleanUsername || !cleanEmail || !cleanPassword) {
    res.status(400).json({ message: 'Completa username, email y password' });
    return;
  }

  if (cleanPassword.length < 6) {
    res.status(400).json({ message: 'La contrasena debe tener al menos 6 caracteres' });
    return;
  }

  const db = await loadDb();
  const exists = db.users.some((item) => item.email === cleanEmail);
  if (exists) {
    res.status(409).json({ message: 'Ya existe una cuenta con ese email' });
    return;
  }

  const passwordHash = await bcrypt.hash(cleanPassword, 10);
  const user: DbUser = {
    id: randomUUID(),
    username: cleanUsername,
    email: cleanEmail,
    passwordHash
  };

  db.users.push(user);
  db.trackers[user.id] = createDefaultTracker();
  await saveDb(db);

  res.status(201).json({
    token: signToken(user),
    user: {
      id: user.id,
      username: user.username,
      email: user.email
    }
  });
});

app.post('/api/auth/login', async (req: Request, res: Response) => {
  const { email, password } = req.body as { email?: string; password?: string };
  const cleanEmail = email?.trim().toLowerCase() ?? '';
  const cleanPassword = password?.trim() ?? '';

  if (!cleanEmail || !cleanPassword) {
    res.status(400).json({ message: 'Completa email y password' });
    return;
  }

  const db = await loadDb();
  const user = db.users.find((item) => item.email === cleanEmail);
  if (!user) {
    res.status(401).json({ message: 'Credenciales invalidas' });
    return;
  }

  const validPassword = await bcrypt.compare(cleanPassword, user.passwordHash);
  if (!validPassword) {
    res.status(401).json({ message: 'Credenciales invalidas' });
    return;
  }

  res.json({
    token: signToken(user),
    user: {
      id: user.id,
      username: user.username,
      email: user.email
    }
  });
});

app.get('/api/tracker', authenticate, async (req: AuthRequest, res: Response) => {
  const userId = req.userId;
  if (!userId) {
    res.status(401).json({ message: 'No autorizado' });
    return;
  }

  const db = await loadDb();
  const tracker = db.trackers[userId] ?? createDefaultTracker();
  db.trackers[userId] = tracker;
  await saveDb(db);
  res.json({ tracker });
});

app.put('/api/tracker', authenticate, async (req: AuthRequest, res: Response) => {
  const userId = req.userId;
  if (!userId) {
    res.status(401).json({ message: 'No autorizado' });
    return;
  }

  const tracker = sanitizeTracker(req.body?.tracker ?? req.body);
  const db = await loadDb();
  db.trackers[userId] = tracker;
  await saveDb(db);

  res.json({ tracker });
});

/**
 * Example Express Rest API endpoints can be defined here.
 * Uncomment and define endpoints as necessary.
 *
 * Example:
 * ```ts
 * app.get('/api/**', (req, res) => {
 *   // Handle API request
 * });
 * ```
 */

/**
 * Serve static files from /browser
 */
app.get(
  '**',
  express.static(browserDistFolder, {
    maxAge: '1y',
    index: 'index.html'
  }),
);

/**
 * Handle all other requests by rendering the Angular application.
 */
app.get('**', (req, res, next) => {
  const { protocol, originalUrl, baseUrl, headers } = req;

  commonEngine
    .render({
      bootstrap,
      documentFilePath: indexHtml,
      url: `${protocol}://${headers.host}${originalUrl}`,
      publicPath: browserDistFolder,
      providers: [{ provide: APP_BASE_HREF, useValue: baseUrl }],
    })
    .then((html) => res.send(html))
    .catch((err) => next(err));
});

/**
 * Start the server if this module is the main entry point.
 * The server listens on the port defined by the `PORT` environment variable, or defaults to 4000.
 */
if (isMainModule(import.meta.url)) {
  const port = process.env['PORT'] || 4000;
  app.listen(port, () => {
    console.log(`Node Express server listening on http://localhost:${port}`);
  });
}

export default app;
