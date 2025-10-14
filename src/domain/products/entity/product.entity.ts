import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  CreateDateColumn,
  UpdateDateColumn,
  Index,
} from 'typeorm';

// 카테고리별로 다른 속성을 가질 수 있는 동적 속성 인터페이스
interface ProductAttributes {
  // 의류
  clothing?: {
    size: string[];
    color: string[];
    material: string;
    fit: 'slim' | 'regular' | 'loose';
    care_instructions: string[];
  };
  // 전자제품
  electronics?: {
    brand: string;
    model: string;
    warranty_months: number;
    power_consumption: string;
    dimensions: {
      width: number;
      height: number;
      depth: number;
      weight: number;
    };
    features: string[];
  };
  // 식품
  food?: {
    expiry_date: string;
    nutritional_info: {
      calories_per_100g: number;
      protein: number;
      fat: number;
      carbs: number;
      fiber: number;
    };
    allergens: string[];
    storage_conditions: string;
  };
  // 도서
  books?: {
    author: string;
    publisher: string;
    isbn: string;
    pages: number;
    language: string;
    publication_date: string;
    genre: string[];
  };
}

// 가격 이력 인터페이스
interface PriceHistory {
  price: number;
  discount_price?: number;
  discount_percentage?: number;
  effective_date: string;
  reason: 'initial' | 'promotion' | 'seasonal' | 'clearance' | 'price_adjustment';
  notes?: string;
}

// 재고 정보 인터페이스
interface InventoryInfo {
  total_quantity: number;
  reserved_quantity: number;
  available_quantity: number;
  reorder_level: number;
  warehouse_locations: Array<{
    warehouse_id: string;
    location: string;
    quantity: number;
  }>;
  last_restock_date: string;
}

// 상품 변형 (색상, 사이즈 등의 조합)
interface ProductVariant {
  sku: string;
  name: string;
  attributes: Record<string, string>; // {color: 'red', size: 'M'}
  price_adjustment: number; // 기본 가격에서 조정값
  inventory: {
    quantity: number;
    reserved: number;
  };
  images: string[];
  is_active: boolean;
}

// SEO 최적화 정보
interface SeoInfo {
  meta_title: string;
  meta_description: string;
  keywords: string[];
  slug: string;
  og_image?: string;
  structured_data?: Record<string, any>;
}

// 배송 정보
interface ShippingInfo {
  weight: number;
  dimensions: {
    length: number;
    width: number;
    height: number;
  };
  shipping_class: 'standard' | 'heavy' | 'fragile' | 'oversized';
  restrictions: {
    countries_excluded: string[];
    requires_signature: boolean;
    age_verification: boolean;
  };
  estimated_delivery_days: {
    domestic: number;
    international: number;
  };
}

@Entity('products')
@Index('idx_category_brand', ['category', 'brand'])
@Index('idx_price_range', ['current_price'])
@Index('idx_attributes_gin', { synchronize: false }) // JSONB GIN 인덱스는 마이그레이션에서 생성
export class Product {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 255 })
  name: string;

  @Column({ length: 100 })
  brand: string;

  @Column({ length: 50 })
  category: string;

  @Column('text')
  description: string;

  @Column('text', { nullable: true })
  short_description: string;

  @Column('decimal', { precision: 10, scale: 2 })
  current_price: number;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  original_price: number;

  @Column({ unique: true })
  sku: string;

  // PostgreSQL의 텍스트 배열 타입 활용
  @Column('text', { array: true, default: '{}' })
  tags: string[];

  @Column('text', { array: true, default: '{}' })
  image_urls: string[];

  // 동적 상품 속성 - 카테고리별로 다른 필드를 가질 수 있음
  @Column('jsonb', { default: '{}' })
  attributes: ProductAttributes;

  // 가격 변경 이력 저장
  @Column('jsonb', { default: '[]' })
  price_history: PriceHistory[];

  // 재고 정보 (복잡한 창고별 재고 관리)
  @Column('jsonb')
  inventory_info: InventoryInfo;

  // 상품 변형들 (색상, 사이즈 조합별)
  @Column('jsonb', { default: '[]' })
  variants: ProductVariant[];

  // SEO 최적화 정보
  @Column('jsonb', { default: '{}' })
  seo_info: SeoInfo;

  // 배송 관련 정보
  @Column('jsonb')
  shipping_info: ShippingInfo;

  // 상품 통계 정보 (조회수, 판매량 등)
  @Column('jsonb', {
    default: {
      view_count: 0,
      purchase_count: 0,
      wishlist_count: 0,
      review_count: 0,
      average_rating: 0,
      last_viewed: null,
      trending_score: 0,
    },
  })
  statistics: {
    view_count: number;
    purchase_count: number;
    wishlist_count: number;
    review_count: number;
    average_rating: number;
    last_viewed: string | null;
    trending_score: number;
  };

  // 상품 설정 (판매 상태, 노출 설정 등)
  @Column('jsonb', {
    default: {
      is_active: true,
      is_featured: false,
      is_on_sale: false,
      show_in_search: true,
      allow_reviews: true,
      auto_publish: true,
      visibility: 'public',
    },
  })
  settings: {
    is_active: boolean;
    is_featured: boolean;
    is_on_sale: boolean;
    show_in_search: boolean;
    allow_reviews: boolean;
    auto_publish: boolean;
    visibility: 'public' | 'private' | 'hidden';
  };

  @CreateDateColumn()
  created_at: Date;

  @UpdateDateColumn()
  updated_at: Date;

  // 출시일 (사전 주문 상품 등을 위해)
  @Column({ type: 'timestamp', nullable: true })
  release_date: Date;

  // 판매 중단일
  @Column({ type: 'timestamp', nullable: true })
  discontinued_at: Date;
}