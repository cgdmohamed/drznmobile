import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of, throwError } from 'rxjs';
import { map } from 'rxjs/operators';
import { catchError } from 'rxjs/operators';
import { environment } from '../../environments/environment';

interface ProductReview {
  id: number;
  date_created: string;
  reviewer: string;
  reviewer_email: string;
  review: string;
  rating: number;
  verified: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ReviewService {
  private apiUrl = environment.apiUrl;
  private consumerKey = environment.consumerKey;
  private consumerSecret = environment.consumerSecret;

  constructor(private http: HttpClient) { }

  // Get all reviews for a product
  getProductReviews(productId: number): Observable<ProductReview[]> {
    const url = `${this.apiUrl}/wp-json/wc/v3/products/${productId}/reviews?consumer_key=${this.consumerKey}&consumer_secret=${this.consumerSecret}`;
    
    return this.http.get<ProductReview[]>(url).pipe(
      catchError(error => {
        console.error(`Error fetching reviews for product ${productId}:`, error);
        return of([]);
      })
    );
  }

  // Create a new review for a product
  createReview(productId: number, reviewData: any): Observable<ProductReview> {
    const url = `${this.apiUrl}/wp-json/wc/v3/products/${productId}/reviews?consumer_key=${this.consumerKey}&consumer_secret=${this.consumerSecret}`;
    
    return this.http.post<ProductReview>(url, reviewData).pipe(
      catchError(error => {
        console.error('Error creating review:', error);
        return throwError(() => new Error(error.error?.message || 'Failed to submit review. Please try again.'));
      })
    );
  }

  // Delete a review
  deleteReview(reviewId: number): Observable<any> {
    const url = `${this.apiUrl}/wp-json/wc/v3/products/reviews/${reviewId}?consumer_key=${this.consumerKey}&consumer_secret=${this.consumerSecret}&force=true`;
    
    return this.http.delete(url).pipe(
      map(() => ({ success: true })),
      catchError(error => {
        console.error('Error deleting review:', error);
        return throwError(() => new Error(error.error?.message || 'Failed to delete review.'));
      })
    );
  }
}