import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { map } from 'rxjs/operators';
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
    const url = `${this.apiUrl}/products/${productId}/reviews?consumer_key=${this.consumerKey}&consumer_secret=${this.consumerSecret}`;
    
    // In a real application, this would fetch data from the API
    // For demo purposes, generating static review data
    return of(this.generateDemoReviews(productId));
  }

  // Create a new review for a product
  createReview(productId: number, reviewData: any): Observable<ProductReview> {
    const url = `${this.apiUrl}/products/${productId}/reviews?consumer_key=${this.consumerKey}&consumer_secret=${this.consumerSecret}`;
    
    // In a real application, this would post data to the API
    // For demo purposes, returning a fake response
    const fakeResponse: ProductReview = {
      id: Math.floor(Math.random() * 1000) + 1,
      date_created: new Date().toISOString(),
      reviewer: reviewData.reviewer,
      reviewer_email: reviewData.reviewer_email,
      review: reviewData.review,
      rating: reviewData.rating,
      verified: false
    };
    
    return of(fakeResponse);
  }

  // Delete a review
  deleteReview(reviewId: number): Observable<any> {
    const url = `${this.apiUrl}/products/reviews/${reviewId}?consumer_key=${this.consumerKey}&consumer_secret=${this.consumerSecret}`;
    
    // In a real application, this would delete data from the API
    // For demo purposes, returning a fake success response
    return of({ success: true });
  }

  // Generate demo reviews for testing
  private generateDemoReviews(productId: number): ProductReview[] {
    const reviewCount = Math.floor(Math.random() * 5) + 1; // 1-5 reviews
    const reviews: ProductReview[] = [];
    
    const reviewers = [
      'محمد أحمد',
      'سارة علي',
      'أحمد محمود',
      'فاطمة حسن',
      'عبدالله خالد'
    ];
    
    const reviewContents = [
      'منتج رائع، أنصح به بشدة!',
      'جودة ممتازة وسعر مناسب.',
      'وصل المنتج بشكل سريع وكان مطابق للوصف تماماً.',
      'تجربة شراء ممتازة، سأعود للتسوق مرة أخرى.',
      'المنتج جيد ولكن التوصيل تأخر قليلاً.'
    ];
    
    for (let i = 0; i < reviewCount; i++) {
      const reviewIndex = i % reviewContents.length;
      const nameIndex = i % reviewers.length;
      
      reviews.push({
        id: 1000 + i,
        date_created: new Date(Date.now() - (i * 86400000)).toISOString(), // Each review 1 day apart
        reviewer: reviewers[nameIndex],
        reviewer_email: `user${i+1}@example.com`,
        review: reviewContents[reviewIndex],
        rating: Math.floor(Math.random() * 3) + 3, // Ratings between 3-5
        verified: Math.random() > 0.5 // Randomly verified
      });
    }
    
    return reviews;
  }
}