import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class SeriesService {
  private apiUrl = 'http://localhost:3000/api';

  constructor(private http: HttpClient) { }

  getTrendingSeries(): Observable<any> {
    return this.http.get(`${this.apiUrl}/trending-series`);
  }

  searchSeries(query: string): Observable<any> {
    return this.http.get(`${this.apiUrl}/search`, { params: { query } });
  }
}