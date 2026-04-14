import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { SolarForecastPoint, SolarForecastRequest } from '../models/solar-forecast.model';

@Injectable({ providedIn: 'root' })
export class SolarForecastService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'http://localhost:8080/api/solar-forecast';

  fetchForecast(request: SolarForecastRequest): Observable<SolarForecastPoint[]> {
    return this.http.post<SolarForecastPoint[]>(this.baseUrl, request);
  }
}
