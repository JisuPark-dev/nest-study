import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Product } from '../entity/product.entity';

interface ProductSearchFilters {
  category?: string;
  brand?: string;
  minPrice?: number;
  maxPrice?: number;
  tags?: string[];
  attributes?: Record<string, any>;
  inStock?: boolean;
}

@Injectable()
export class ProductService {
  constructor(
    @InjectRepository(Product)
    private productRepository: Repository<Product>,
    private dataSource: DataSource,
  ) {}

  // 1. 동적 속성으로 상품 검색 (의류 예시)
  async findClothingByAttributes(
    size?: string,
    color?: string,
    material?: string,
    fit?: 'slim' | 'regular' | 'loose',
  ): Promise<Product[]> {
    const queryBuilder = this.productRepository.createQueryBuilder('product');
    
    queryBuilder.where("product.category = 'clothing'");

    if (size) {
      queryBuilder.andWhere(
        "product.attributes->'clothing'->>'size' ? :size",
        { size },
      );
    }

    if (color) {
      queryBuilder.andWhere(
        "product.attributes->'clothing'->>'color' ? :color",
        { color },
      );
    }

    if (material) {
      queryBuilder.andWhere(
        "product.attributes->'clothing'->>'material' = :material",
        { material },
      );
    }

    if (fit) {
      queryBuilder.andWhere(
        "product.attributes->'clothing'->>'fit' = :fit",
        { fit },
      );
    }

    return queryBuilder.getMany();
  }

  // 2. 복잡한 JSONB 쿼리 - 전자제품 사양 검색
  async findElectronicsBySpecs(
    brand?: string,
    minWarranty?: number,
    features?: string[],
    maxWeight?: number,
  ): Promise<Product[]> {
    let query = `
      SELECT * FROM products 
      WHERE category = 'electronics'
        AND settings->>'is_active' = 'true'
    `;

    const params: any[] = [];
    let paramIndex = 1;

    if (brand) {
      query += ` AND attributes->'electronics'->>'brand' ILIKE $${paramIndex}`;
      params.push(`%${brand}%`);
      paramIndex++;
    }

    if (minWarranty) {
      query += ` AND (attributes->'electronics'->>'warranty_months')::int >= $${paramIndex}`;
      params.push(minWarranty);
      paramIndex++;
    }

    if (features && features.length > 0) {
      query += ` AND attributes->'electronics'->'features' ?| array[${features.map(() => `$${paramIndex++}`).join(',')}]`;
      params.push(...features);
    }

    if (maxWeight) {
      query += ` AND (attributes->'electronics'->'dimensions'->>'weight')::numeric <= $${paramIndex}`;
      params.push(maxWeight);
      paramIndex++;
    }

    query += ' ORDER BY current_price ASC';

    return this.dataSource.query(query, params);
  }

  // 3. 가격 이력 분석
  async getProductPriceHistory(productId: number): Promise<any> {
    const query = `
      SELECT 
        id,
        name,
        current_price,
        jsonb_array_length(price_history) as price_changes_count,
        price_history
      FROM products 
      WHERE id = $1
    `;

    const result = await this.dataSource.query(query, [productId]);
    if (!result.length) {
      throw new NotFoundException(`Product with ID ${productId} not found`);
    }

    return result[0];
  }

  // 4. 재고 부족 상품 조회 (복잡한 재고 계산)
  async findLowStockProducts(threshold: number = 10): Promise<Product[]> {
    const query = `
      SELECT 
        id, name, sku, current_price,
        inventory_info,
        (inventory_info->>'available_quantity')::int as available_qty,
        (inventory_info->>'reorder_level')::int as reorder_level
      FROM products 
      WHERE (inventory_info->>'available_quantity')::int <= $1
        AND settings->>'is_active' = 'true'
      ORDER BY (inventory_info->>'available_quantity')::int ASC
    `;

    return this.dataSource.query(query, [threshold]);
  }

  // 5. 상품 변형별 재고 확인
  async getProductVariantsStock(productId: number): Promise<any> {
    const query = `
      SELECT 
        id, name,
        jsonb_array_elements(variants) as variant
      FROM products 
      WHERE id = $1
        AND jsonb_array_length(variants) > 0
    `;

    return this.dataSource.query(query, [productId]);
  }

  // 6. 베스트셀러 분석 (통계 정보 활용)
  async getBestSellingProducts(limit: number = 10): Promise<Product[]> {
    const query = `
      SELECT 
        id, name, brand, current_price,
        statistics,
        (statistics->>'purchase_count')::int as sales_count,
        (statistics->>'average_rating')::numeric as avg_rating
      FROM products 
      WHERE settings->>'is_active' = 'true'
        AND (statistics->>'purchase_count')::int > 0
      ORDER BY 
        (statistics->>'purchase_count')::int DESC,
        (statistics->>'average_rating')::numeric DESC
      LIMIT $1
    `;

    return this.dataSource.query(query, [limit]);
  }

  // 7. 세일 상품 자동 관리
  async updateSaleStatus(): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      // 할인이 있는 상품들을 세일 상품으로 마킹
      const query = `
        UPDATE products 
        SET settings = jsonb_set(settings, '{is_on_sale}', 'true')
        WHERE original_price > current_price
          AND settings->>'is_active' = 'true'
      `;

      await manager.query(query);

      // 할인이 없는 상품들의 세일 상태 해제
      const query2 = `
        UPDATE products 
        SET settings = jsonb_set(settings, '{is_on_sale}', 'false')
        WHERE (original_price IS NULL OR original_price <= current_price)
          AND settings->>'is_on_sale' = 'true'
      `;

      await manager.query(query2);
    });
  }

  // 8. 카테고리별 속성 통계
  async getCategoryAttributeStats(category: string): Promise<any> {
    const query = `
      SELECT 
        category,
        COUNT(*) as total_products,
        jsonb_object_agg(
          key, 
          jsonb_object_agg(
            sub_key, 
            count
          )
        ) as attribute_distribution
      FROM (
        SELECT 
          category,
          attr_key.key as key,
          sub_attr.key as sub_key,
          COUNT(*) as count
        FROM products,
             jsonb_each(attributes) as attr_key(key, value),
             jsonb_each_text(attr_key.value) as sub_attr(key, value)
        WHERE category = $1
          AND settings->>'is_active' = 'true'
        GROUP BY category, attr_key.key, sub_attr.key
      ) stats
      GROUP BY category
    `;

    return this.dataSource.query(query, [category]);
  }

  // 9. 추천 상품 알고리즘 (유사 속성 기반)
  async getRecommendedProducts(
    productId: number,
    limit: number = 5,
  ): Promise<Product[]> {
    const query = `
      WITH target_product AS (
        SELECT category, brand, attributes, current_price
        FROM products 
        WHERE id = $1
      )
      SELECT 
        p.id, p.name, p.brand, p.current_price,
        p.statistics,
        -- 유사도 점수 계산
        CASE 
          WHEN p.brand = tp.brand THEN 2
          ELSE 0
        END +
        CASE 
          WHEN ABS(p.current_price - tp.current_price) <= (tp.current_price * 0.3) THEN 1
          ELSE 0
        END +
        CASE 
          WHEN p.attributes && tp.attributes THEN 1  -- JSONB 교집합 연산자
          ELSE 0
        END as similarity_score
      FROM products p, target_product tp
      WHERE p.category = tp.category
        AND p.id != $1
        AND p.settings->>'is_active' = 'true'
        AND (p.statistics->>'average_rating')::numeric >= 3.0
      ORDER BY 
        similarity_score DESC,
        (p.statistics->>'purchase_count')::int DESC
      LIMIT $2
    `;

    return this.dataSource.query(query, [productId, limit]);
  }

  // 10. 상품 가격 업데이트 (이력 보존)
  async updateProductPrice(
    productId: number,
    newPrice: number,
    reason: string,
    notes?: string,
  ): Promise<Product> {
    return this.dataSource.transaction(async (manager) => {
      const product = await manager.findOne(Product, {
        where: { id: productId },
      });

      if (!product) {
        throw new NotFoundException(`Product with ID ${productId} not found`);
      }

      // 현재 가격을 이력에 추가
      const priceHistoryEntry = {
        price: newPrice,
        discount_price: product.current_price < newPrice ? product.current_price : undefined,
        discount_percentage: product.current_price < newPrice 
          ? Math.round(((newPrice - product.current_price) / newPrice) * 100)
          : undefined,
        effective_date: new Date().toISOString(),
        reason: reason as any,
        notes,
      };

      product.price_history.push(priceHistoryEntry);
      product.current_price = newPrice;

      return manager.save(Product, product);
    });
  }
}