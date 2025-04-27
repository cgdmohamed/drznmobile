import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError, combineLatest } from 'rxjs';
import { catchError, map, switchMap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

export interface ShippingZone {
  id: number;
  name: string;
  order: number;
  _links: any;
}

export interface ShippingMethod {
  id: number;
  instance_id: number;
  title: string;
  method_id: string;
  method_title: string;
  description: string;
  cost?: string;
  min_amount?: string;
  settings?: any;
  enabled: boolean;
  _links: any;
}

@Injectable({
  providedIn: 'root'
})
export class ShippingService {
  private apiUrl = environment.apiUrl;
  private consumerKey = environment.consumerKey;
  private consumerSecret = environment.consumerSecret;

  constructor(private http: HttpClient) { }

  /**
   * Get all shipping zones
   */
  getShippingZones(): Observable<ShippingZone[]> {
    return this.http.get<ShippingZone[]>(`${this.apiUrl}/shipping/zones`, {
      params: {
        consumer_key: this.consumerKey,
        consumer_secret: this.consumerSecret
      }
    }).pipe(
      catchError(error => {
        console.error('Error fetching shipping zones:', error);
        return of([]);
      })
    );
  }

  /**
   * Get shipping methods for a specific zone
   * @param zoneId The ID of the shipping zone
   */
  getShippingMethods(zoneId: number): Observable<ShippingMethod[]> {
    return this.http.get<ShippingMethod[]>(`${this.apiUrl}/shipping/zones/${zoneId}/methods`, {
      params: {
        consumer_key: this.consumerKey,
        consumer_secret: this.consumerSecret
      }
    }).pipe(
      catchError(error => {
        console.error(`Error fetching shipping methods for zone ${zoneId}:`, error);
        return of([]);
      })
    );
  }

  /**
   * Get shipping zone for a specific location
   * @param country The country code
   * @param state The state code (optional)
   * @param postcode The postcode (optional)
   */
  getShippingZoneForLocation(country: string, state?: string, postcode?: string): Observable<number> {
    // Build query parameters
    const params: any = {
      consumer_key: this.consumerKey,
      consumer_secret: this.consumerSecret
    };

    // Add optional parameters if provided
    if (country) params.country = country;
    if (state) params.state = state;
    if (postcode) params.postcode = postcode;

    // Make the API call
    return this.http.get<any>(`${this.apiUrl}/shipping/zones/match`, {
      params
    }).pipe(
      map(response => {
        if (response && response.id) {
          return response.id;
        }
        // If no matching zone, return default zone (0)
        return 0;
      }),
      catchError(error => {
        console.error('Error matching shipping zone for location:', error);
        // Return default zone on error
        return of(0);
      })
    );
  }

  /**
   * Get all shipping methods across all zones
   */
  getAllShippingMethods(): Observable<{zone: ShippingZone, methods: ShippingMethod[]}[]> {
    return this.getShippingZones().pipe(
      switchMap(zones => {
        // For each zone, we need to get its methods
        if (!zones || zones.length === 0) {
          return of([]);
        }

        // Map each zone to an observable of zone+methods
        const zoneObservables = zones.map(zone => 
          this.getShippingMethods(zone.id).pipe(
            map(methods => ({
              zone,
              methods: methods || []
            }))
          )
        );
        
        // Combine all observables into a single observable of results
        return combineLatest(zoneObservables);
      }),
      catchError(error => {
        console.error('Error fetching all shipping methods:', error);
        return of([]);
      })
    );
  }

  /**
   * Calculate shipping cost for a shipment
   * @param zoneId The shipping zone ID
   * @param methodId The shipping method ID
   * @param items The cart items (for weight/size based calculations)
   */
  calculateShipping(zoneId: number, methodId: number, items: any[]): Observable<number> {
    // In a real implementation, this would call the API to calculate shipping
    // But WooCommerce doesn't have a direct endpoint for this
    
    return this.getShippingMethods(zoneId).pipe(
      map(methods => {
        const selectedMethod = methods.find(m => m.id === methodId);
        if (selectedMethod && selectedMethod.cost) {
          return parseFloat(selectedMethod.cost);
        }
        // Default shipping cost
        return 10;
      }),
      catchError(error => {
        console.error('Error calculating shipping:', error);
        return of(10); // Default to 10 SAR
      })
    );
  }
}