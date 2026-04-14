import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { BatteryOptRequest, BatteryOptResult } from '../models/battery-optimization.model';

@Injectable({ providedIn: 'root' })
export class BatteryOptimizationService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = 'http://localhost:8080/api/battery-optimization';

  optimize(request: BatteryOptRequest): Observable<BatteryOptResult> {
    return this.http.post<BatteryOptResult>(this.baseUrl, request);
  }
}
