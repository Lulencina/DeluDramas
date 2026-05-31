import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';

type SectionKey = 'kdramas' | 'artists' | 'asian';
type DramaListKey = 'watchedLiked' | 'watchedDisliked' | 'watching' | 'wishlist' | 'unfinished';

interface AuthResponse {
  token: string;
  user: {
    id: string;
    username: string;
    email: string;
  };
}

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

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'DeluDramas Hub';
  private readonly apiBase = this.resolveApiBase();
  private readonly tokenKey = 'deludramas-token';
  private readonly userKey = 'deludramas-current-user';

  activeSection: SectionKey = 'kdramas';
  authMode: 'login' | 'register' = 'login';
  isLoggedIn = false;
  currentUser = '';
  authToken = '';
  authError = '';
  saveError = '';
  isSaving = false;

  authForm = {
    username: '',
    email: '',
    password: ''
  };

  kdramaForm = {
    watchedLiked: '',
    watchedDisliked: '',
    watching: '',
    wishlist: '',
    unfinished: '',
    opinion: ''
  };

  artistForm = {
    name: '',
    favoriteMusic: '',
    review: '',
    photoUrl: ''
  };

  asianDramaForm = {
    watchedLiked: '',
    watchedDisliked: '',
    watching: '',
    wishlist: '',
    unfinished: '',
    opinion: ''
  };

  asianArtistForm = {
    name: '',
    favoriteMusic: '',
    review: '',
    photoUrl: ''
  };

  kdramas: DramaBucket = this.createDramaBucket();

  artists: ArtistItem[] = [];

  asian = {
    dramas: this.createDramaBucket(),
    artists: [] as ArtistItem[]
  };

  constructor(private readonly http: HttpClient) {
    this.restoreSession();
    if (this.isLoggedIn) {
      void this.loadTracker();
    }
  }

  private get hasStorage(): boolean {
    return typeof localStorage !== 'undefined';
  }

  private createDramaBucket(): DramaBucket {
    return {
      watchedLiked: [],
      watchedDisliked: [],
      watching: [],
      wishlist: [],
      unfinished: [],
      opinions: []
    };
  }

  private resolveApiBase(): string {
    return '/api';
  }

  private extractApiError(error: unknown, fallback: string): string {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 0) {
        return 'No hay conexion con el backend. Verifica que la API este levantada.';
      }
      const apiMessage = typeof error.error?.message === 'string' ? error.error.message : '';
      return apiMessage || fallback;
    }

    return fallback;
  }

  private get authHeaders(): HttpHeaders {
    return new HttpHeaders({
      Authorization: `Bearer ${this.authToken}`
    });
  }

  private restoreSession(): void {
    const savedUser = this.hasStorage ? localStorage.getItem(this.userKey) : null;
    const savedToken = this.hasStorage ? localStorage.getItem(this.tokenKey) : null;

    if (savedUser) {
      this.currentUser = savedUser;
    }

    if (savedToken) {
      this.authToken = savedToken;
    }

    this.isLoggedIn = !!savedUser && !!savedToken;
  }

  private storeSession(response: AuthResponse): void {
    this.currentUser = response.user.username;
    this.authToken = response.token;
    this.isLoggedIn = true;

    if (!this.hasStorage) {
      return;
    }

    localStorage.setItem(this.userKey, response.user.username);
    localStorage.setItem(this.tokenKey, response.token);
  }

  private clearSession(): void {
    this.isLoggedIn = false;
    this.currentUser = '';
    this.authToken = '';

    if (!this.hasStorage) {
      return;
    }

    localStorage.removeItem(this.userKey);
    localStorage.removeItem(this.tokenKey);
  }

  setAuthMode(mode: 'login' | 'register'): void {
    this.authMode = mode;
  }

  async register(): Promise<void> {
    this.authError = '';

    const username = this.authForm.username.trim();
    const email = this.authForm.email.trim().toLowerCase();
    const password = this.authForm.password.trim();

    if (!username || !email || !password) {
      this.authError = 'Completa todos los campos';
      return;
    }

    try {
      const response = await firstValueFrom(
        this.http.post<AuthResponse>(`${this.apiBase}/auth/register`, {
          username,
          email,
          password
        })
      );

      this.storeSession(response);
      this.resetAuthForm();
      await this.loadTracker();
    } catch (error) {
      this.authError = this.extractApiError(error, 'No se pudo registrar. Verifica los datos.');
    }
  }

  async login(): Promise<void> {
    this.authError = '';

    const email = this.authForm.email.trim().toLowerCase();
    const password = this.authForm.password.trim();

    if (!email || !password) {
      this.authError = 'Completa email y contrasena';
      return;
    }

    try {
      const response = await firstValueFrom(
        this.http.post<AuthResponse>(`${this.apiBase}/auth/login`, {
          email,
          password
        })
      );

      this.storeSession(response);
      this.resetAuthForm();
      await this.loadTracker();
    } catch (error) {
      this.authError = this.extractApiError(error, 'Credenciales invalidas o servidor no disponible');
    }
  }

  logout(): void {
    this.clearSession();
    this.kdramas = this.createDramaBucket();
    this.artists = [];
    this.asian = { dramas: this.createDramaBucket(), artists: [] };
  }

  selectSection(section: SectionKey): void {
    this.activeSection = section;
  }

  async submitAuth(): Promise<void> {
    if (this.authMode === 'register') {
      await this.register();
      return;
    }
    await this.login();
  }

  private applyTracker(tracker: TrackerState): void {
    this.kdramas = {
      watchedLiked: [...tracker.kdramas.watchedLiked],
      watchedDisliked: [...tracker.kdramas.watchedDisliked],
      watching: [...tracker.kdramas.watching],
      wishlist: [...tracker.kdramas.wishlist],
      unfinished: [...tracker.kdramas.unfinished],
      opinions: [...tracker.kdramas.opinions]
    };

    this.artists = [...tracker.artists];
    this.asian = {
      dramas: {
        watchedLiked: [...tracker.asian.dramas.watchedLiked],
        watchedDisliked: [...tracker.asian.dramas.watchedDisliked],
        watching: [...tracker.asian.dramas.watching],
        wishlist: [...tracker.asian.dramas.wishlist],
        unfinished: [...tracker.asian.dramas.unfinished],
        opinions: [...tracker.asian.dramas.opinions]
      },
      artists: [...tracker.asian.artists]
    };
  }

  private getTrackerPayload(): TrackerState {
    return {
      kdramas: {
        watchedLiked: [...this.kdramas.watchedLiked],
        watchedDisliked: [...this.kdramas.watchedDisliked],
        watching: [...this.kdramas.watching],
        wishlist: [...this.kdramas.wishlist],
        unfinished: [...this.kdramas.unfinished],
        opinions: [...this.kdramas.opinions]
      },
      artists: [...this.artists],
      asian: {
        dramas: {
          watchedLiked: [...this.asian.dramas.watchedLiked],
          watchedDisliked: [...this.asian.dramas.watchedDisliked],
          watching: [...this.asian.dramas.watching],
          wishlist: [...this.asian.dramas.wishlist],
          unfinished: [...this.asian.dramas.unfinished],
          opinions: [...this.asian.dramas.opinions]
        },
        artists: [...this.asian.artists]
      }
    };
  }

  private async loadTracker(): Promise<void> {
    if (!this.authToken) {
      return;
    }

    try {
      const response = await firstValueFrom(
        this.http.get<{ tracker: TrackerState }>(`${this.apiBase}/tracker`, {
          headers: this.authHeaders
        })
      );
      this.applyTracker(response.tracker);
    } catch (error) {
      this.authError = this.extractApiError(error, 'No se pudo cargar tu informacion');
    }
  }

  private persistTracker(): void {
    if (!this.authToken) {
      return;
    }

    this.isSaving = true;
    this.saveError = '';

    void firstValueFrom(
      this.http.put<{ tracker: TrackerState }>(
        `${this.apiBase}/tracker`,
        { tracker: this.getTrackerPayload() },
        { headers: this.authHeaders }
      )
    )
      .then(() => {
        this.isSaving = false;
      })
      .catch((error) => {
        this.isSaving = false;
        this.saveError = this.extractApiError(error, 'No se pudo guardar en el servidor');
      });
  }

  private editWithPrompt(value: string, message: string): string | null {
    if (typeof window === 'undefined') {
      return null;
    }

    const edited = window.prompt(message, value);
    if (edited === null) {
      return null;
    }

    const clean = edited.trim();
    if (!clean) {
      return null;
    }

    return clean;
  }

  addKdrama(list: DramaListKey): void {
    const rawValue = this.kdramaForm[list];
    const value = rawValue.trim();
    if (!value) {
      return;
    }
    this.kdramas[list] = [...this.kdramas[list], value];
    this.kdramaForm[list] = '';
    this.persistTracker();
  }

  editKdrama(list: DramaListKey, index: number): void {
    const current = this.kdramas[list][index];
    const edited = this.editWithPrompt(current, 'Editar titulo');
    if (!edited) {
      return;
    }
    const next = [...this.kdramas[list]];
    next[index] = edited;
    this.kdramas[list] = next;
    this.persistTracker();
  }

  removeKdrama(list: DramaListKey, index: number): void {
    this.kdramas[list] = this.kdramas[list].filter((_, itemIndex) => itemIndex !== index);
    this.persistTracker();
  }

  addKdramaOpinion(): void {
    const opinion = this.kdramaForm.opinion.trim();
    if (!opinion) {
      return;
    }
    this.kdramas.opinions = [...this.kdramas.opinions, opinion];
    this.kdramaForm.opinion = '';
    this.persistTracker();
  }

  editKdramaOpinion(index: number): void {
    const current = this.kdramas.opinions[index];
    const edited = this.editWithPrompt(current, 'Editar opinion');
    if (!edited) {
      return;
    }
    const next = [...this.kdramas.opinions];
    next[index] = edited;
    this.kdramas.opinions = next;
    this.persistTracker();
  }

  removeKdramaOpinion(index: number): void {
    this.kdramas.opinions = this.kdramas.opinions.filter((_, itemIndex) => itemIndex !== index);
    this.persistTracker();
  }

  addArtist(): void {
    const name = this.artistForm.name.trim();
    const favoriteMusic = this.artistForm.favoriteMusic.trim();
    const review = this.artistForm.review.trim();
    const photoUrl = this.artistForm.photoUrl.trim();

    if (!name || !favoriteMusic || !review || !photoUrl) {
      return;
    }

    this.artists = [...this.artists, { name, favoriteMusic, review, photoUrl }];
    this.artistForm = { name: '', favoriteMusic: '', review: '', photoUrl: '' };
    this.persistTracker();
  }

  editArtist(index: number): void {
    const target = this.artists[index];
    if (!target) {
      return;
    }

    const name = this.editWithPrompt(target.name, 'Editar nombre de artista');
    const favoriteMusic = this.editWithPrompt(target.favoriteMusic, 'Editar musica favorita');
    const review = this.editWithPrompt(target.review, 'Editar reseña');
    const photoUrl = this.editWithPrompt(target.photoUrl, 'Editar foto URL');

    if (!name || !favoriteMusic || !review || !photoUrl) {
      return;
    }

    const next = [...this.artists];
    next[index] = { name, favoriteMusic, review, photoUrl };
    this.artists = next;
    this.persistTracker();
  }

  removeArtist(index: number): void {
    this.artists = this.artists.filter((_, itemIndex) => itemIndex !== index);
    this.persistTracker();
  }

  addAsianDrama(list: DramaListKey): void {
    const rawValue = this.asianDramaForm[list];
    const value = rawValue.trim();
    if (!value) {
      return;
    }
    this.asian.dramas[list] = [...this.asian.dramas[list], value];
    this.asianDramaForm[list] = '';
    this.persistTracker();
  }

  editAsianDrama(list: DramaListKey, index: number): void {
    const current = this.asian.dramas[list][index];
    const edited = this.editWithPrompt(current, 'Editar titulo');
    if (!edited) {
      return;
    }
    const next = [...this.asian.dramas[list]];
    next[index] = edited;
    this.asian.dramas[list] = next;
    this.persistTracker();
  }

  removeAsianDrama(list: DramaListKey, index: number): void {
    this.asian.dramas[list] = this.asian.dramas[list].filter((_, itemIndex) => itemIndex !== index);
    this.persistTracker();
  }

  addAsianDramaOpinion(): void {
    const opinion = this.asianDramaForm.opinion.trim();
    if (!opinion) {
      return;
    }
    this.asian.dramas.opinions = [...this.asian.dramas.opinions, opinion];
    this.asianDramaForm.opinion = '';
    this.persistTracker();
  }

  editAsianDramaOpinion(index: number): void {
    const current = this.asian.dramas.opinions[index];
    const edited = this.editWithPrompt(current, 'Editar opinion');
    if (!edited) {
      return;
    }
    const next = [...this.asian.dramas.opinions];
    next[index] = edited;
    this.asian.dramas.opinions = next;
    this.persistTracker();
  }

  removeAsianDramaOpinion(index: number): void {
    this.asian.dramas.opinions = this.asian.dramas.opinions.filter((_, itemIndex) => itemIndex !== index);
    this.persistTracker();
  }

  addAsianArtist(): void {
    const name = this.asianArtistForm.name.trim();
    const favoriteMusic = this.asianArtistForm.favoriteMusic.trim();
    const review = this.asianArtistForm.review.trim();
    const photoUrl = this.asianArtistForm.photoUrl.trim();

    if (!name || !favoriteMusic || !review || !photoUrl) {
      return;
    }

    this.asian.artists = [...this.asian.artists, { name, favoriteMusic, review, photoUrl }];
    this.asianArtistForm = { name: '', favoriteMusic: '', review: '', photoUrl: '' };
    this.persistTracker();
  }

  editAsianArtist(index: number): void {
    const target = this.asian.artists[index];
    if (!target) {
      return;
    }

    const name = this.editWithPrompt(target.name, 'Editar nombre de artista');
    const favoriteMusic = this.editWithPrompt(target.favoriteMusic, 'Editar musica favorita');
    const review = this.editWithPrompt(target.review, 'Editar reseña');
    const photoUrl = this.editWithPrompt(target.photoUrl, 'Editar foto URL');

    if (!name || !favoriteMusic || !review || !photoUrl) {
      return;
    }

    const next = [...this.asian.artists];
    next[index] = { name, favoriteMusic, review, photoUrl };
    this.asian.artists = next;
    this.persistTracker();
  }

  removeAsianArtist(index: number): void {
    this.asian.artists = this.asian.artists.filter((_, itemIndex) => itemIndex !== index);
    this.persistTracker();
  }

  private resetAuthForm(): void {
    this.authForm = { username: '', email: '', password: '' };
  }
}