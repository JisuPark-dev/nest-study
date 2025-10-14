-- PostgreSQL의 고급 인덱스 활용 예시
-- 이 파일은 마이그레이션에서 실행되어야 하는 SQL들입니다.

-- 1. JSONB 필드에 GIN 인덱스 생성 (빠른 JSON 검색을 위해)
CREATE INDEX CONCURRENTLY idx_products_attributes_gin ON products USING GIN (attributes);
CREATE INDEX CONCURRENTLY idx_products_inventory_gin ON products USING GIN (inventory_info);
CREATE INDEX CONCURRENTLY idx_products_variants_gin ON products USING GIN (variants);
CREATE INDEX CONCURRENTLY idx_products_statistics_gin ON products USING GIN (statistics);
CREATE INDEX CONCURRENTLY idx_products_settings_gin ON products USING GIN (settings);

-- 2. 특정 JSONB 경로에 대한 인덱스 (자주 검색되는 필드)
CREATE INDEX CONCURRENTLY idx_products_category_active 
ON products ((category), (settings->>'is_active'));

CREATE INDEX CONCURRENTLY idx_products_brand_category 
ON products ((attributes->>'brand'), category);

-- 3. 가격 범위 검색을 위한 인덱스
CREATE INDEX CONCURRENTLY idx_products_price_range 
ON products (current_price) 
WHERE settings->>'is_active' = 'true';

-- 4. 재고 수량별 인덱스
CREATE INDEX CONCURRENTLY idx_products_available_quantity 
ON products (((inventory_info->>'available_quantity')::int)) 
WHERE settings->>'is_active' = 'true';

-- 5. 베스트셀러 조회를 위한 복합 인덱스
CREATE INDEX CONCURRENTLY idx_products_bestseller 
ON products (
    ((statistics->>'purchase_count')::int) DESC,
    ((statistics->>'average_rating')::numeric) DESC
) WHERE settings->>'is_active' = 'true';

-- 6. 의류 속성 검색을 위한 표현식 인덱스
CREATE INDEX CONCURRENTLY idx_products_clothing_size 
ON products USING GIN ((attributes->'clothing'->'size')) 
WHERE category = 'clothing';

CREATE INDEX CONCURRENTLY idx_products_clothing_color 
ON products USING GIN ((attributes->'clothing'->'color')) 
WHERE category = 'clothing';

-- 7. 전자제품 사양 검색을 위한 인덱스
CREATE INDEX CONCURRENTLY idx_products_electronics_brand 
ON products ((attributes->'electronics'->>'brand')) 
WHERE category = 'electronics';

CREATE INDEX CONCURRENTLY idx_products_electronics_warranty 
ON products (((attributes->'electronics'->>'warranty_months')::int)) 
WHERE category = 'electronics';

-- 8. 태그 검색을 위한 GIN 인덱스
CREATE INDEX CONCURRENTLY idx_products_tags_gin ON products USING GIN (tags);

-- 9. 풀텍스트 검색을 위한 인덱스 (상품명, 설명)
CREATE INDEX CONCURRENTLY idx_products_fulltext 
ON products USING GIN (
    to_tsvector('korean', name || ' ' || COALESCE(description, '') || ' ' || COALESCE(short_description, ''))
);

-- 10. 세일 상품 검색을 위한 부분 인덱스
CREATE INDEX CONCURRENTLY idx_products_on_sale 
ON products (current_price, original_price) 
WHERE settings->>'is_on_sale' = 'true' 
AND settings->>'is_active' = 'true';

-- 11. 카테고리별 추천 상품을 위한 인덱스
CREATE INDEX CONCURRENTLY idx_products_recommendations 
ON products (
    category,
    brand,
    ((statistics->>'average_rating')::numeric) DESC,
    ((statistics->>'purchase_count')::int) DESC
) WHERE settings->>'is_active' = 'true';

-- 12. 출시 예정 상품을 위한 인덱스
CREATE INDEX CONCURRENTLY idx_products_upcoming 
ON products (release_date) 
WHERE release_date > NOW() 
AND settings->>'is_active' = 'true';

-- PostgreSQL의 함수 기반 인덱스 예시
-- 13. 할인률 계산 인덱스
CREATE INDEX CONCURRENTLY idx_products_discount_percentage 
ON products (
    (CASE 
        WHEN original_price IS NOT NULL AND original_price > current_price 
        THEN ROUND(((original_price - current_price) / original_price * 100)::numeric, 2)
        ELSE 0 
    END)
) WHERE settings->>'is_active' = 'true';

-- 14. 인기도 점수 계산 인덱스 (복합 점수)
CREATE INDEX CONCURRENTLY idx_products_popularity_score 
ON products (
    (
        ((statistics->>'view_count')::int * 0.1) +
        ((statistics->>'purchase_count')::int * 0.5) +
        ((statistics->>'wishlist_count')::int * 0.2) +
        ((statistics->>'average_rating')::numeric * 0.2)
    ) DESC
) WHERE settings->>'is_active' = 'true';

-- 유니크 제약조건
CREATE UNIQUE INDEX CONCURRENTLY idx_products_sku_unique ON products (sku);

-- 댓글: 이런 인덱스들이 있으면 복잡한 JSONB 쿼리도 빠르게 실행됩니다!
-- MySQL에서는 이런 수준의 JSON 인덱싱이 제한적이지만, 
-- PostgreSQL에서는 매우 강력한 JSONB 인덱싱을 지원합니다.