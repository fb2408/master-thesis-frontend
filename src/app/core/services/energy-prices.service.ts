import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { DayAheadPricePoint } from '../models/day-ahead-price.model';

@Injectable({ providedIn: 'root' })
export class EnergyPricesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'http://localhost:8080/api/day-ahead-prices';

  fetchDayAheadPrices(from: Date, to: Date, zone = 'CROATIA'): Observable<DayAheadPricePoint[]> {
    const params = new HttpParams()
      .set('from', this.toLocalDateTimeString(from))
      .set('to', this.toLocalDateTimeString(to))
      .set('zone', zone);

    return this.http.get<DayAheadPricePoint[]>(this.baseUrl, { params });
  }

  // Spring expects ISO 8601 LocalDateTime without timezone offset
  private toLocalDateTimeString(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
  }
}
