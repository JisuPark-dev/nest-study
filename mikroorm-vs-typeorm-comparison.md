# MikroORM vs TypeORM 비교

이 문서는 실제 프로젝트 코드를 기반으로 MikroORM과 TypeORM의 차이점을 비교합니다.

## 1. Entity 정의 비교

### TypeORM Entity (user.entity.ts)
```typescript
import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

@Entity('users')
export class User {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ length: 100 })
  name: string;

  @Column({ unique: true })
  email: string;

  @Column()
  password: string;

  @Column({ default: true })
  isActive: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
```

### MikroORM Entity (user.mikroorm.entity.ts)
```typescript
import { Entity, PrimaryKey, Property } from '@mikro-orm/core';

@Entity({ tableName: 'users' })
export class UserMikroOrm {
  @PrimaryKey()
  id!: number;

  @Property({ length: 100 })
  name!: string;

  @Property({ unique: true })
  email!: string;

  @Property()
  password!: string;

  @Property({ default: true })
  isActive: boolean = true;

  @Property({ onCreate: () => new Date() })
  createdAt: Date = new Date();

  @Property({ onUpdate: () => new Date() })
  updatedAt: Date = new Date();
}
```

### 주요 차이점
- **데코레이터 명칭**: TypeORM은 `@Column`, MikroORM은 `@Property`
- **테이블 이름 지정**: TypeORM은 `@Entity('users')`, MikroORM은 `@Entity({ tableName: 'users' })`
- **타입스크립트 strictness**: MikroORM은 `!` 연산자 사용으로 더 엄격한 타입 체크
- **날짜 자동 생성**: TypeORM은 `@CreateDateColumn/@UpdateDateColumn`, MikroORM은 `onCreate/onUpdate` 콜백

## 2. Service 구현 비교

### 의존성 주입

**TypeORM (users.service.ts)**
```typescript
constructor(
  @InjectRepository(User)
  private usersRepository: Repository<User>,
  private dataSource: DataSource,
) {}
```

**MikroORM (users.service.v2.ts)**
```typescript
constructor(
  @InjectRepository(UserMikroOrm)
  private readonly usersRepository: EntityRepository<UserMikroOrm>,
  private readonly em: EntityManager,
) {}
```

### CRUD 작업 비교

#### Create 작업

**TypeORM**
```typescript
async create(createUserDto: CreateUserDto): Promise<User> {
  const user = this.usersRepository.create(createUserDto);
  return await this.usersRepository.save(user);
}
```

**MikroORM**
```typescript
async create(createUserDto: CreateUserDto): Promise<UserMikroOrm> {
  const user = this.usersRepository.create(createUserDto);
  await this.em.persistAndFlush(user);
  return user;
}
```

#### Update 작업

**TypeORM**
```typescript
async update(id: number, updateUserDto: UpdateUserDto): Promise<User> {
  return await this.dataSource.transaction(async (manager) => {
    const user = await manager.findOne(User, { where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    Object.assign(user, updateUserDto);
    return await manager.save(User, user);
  });
}
```

**MikroORM**
```typescript
async update(id: number, updateUserDto: UpdateUserDto): Promise<UserMikroOrm> {
  const user = await this.usersRepository.findOne({ id });
  if (!user) {
    throw new NotFoundException(`User with ID ${id} not found`);
  }
  this.usersRepository.assign(user, updateUserDto);
  await this.em.flush();
  return user;
}
```

#### Delete 작업

**TypeORM**
```typescript
async remove(id: number): Promise<void> {
  await this.dataSource.transaction(async (manager) => {
    const user = await manager.findOne(User, { where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    await manager.remove(User, user);
  });
}
```

**MikroORM**
```typescript
async remove(id: number): Promise<void> {
  const user = await this.usersRepository.findOne({ id });
  if (!user) {
    throw new NotFoundException(`User with ID ${id} not found`);
  }
  await this.em.removeAndFlush(user);
}
```

### 트랜잭션 처리 비교

**TypeORM**
```typescript
async bulkUpdateUsers(
  updates: Array<{ id: number; data: Partial<UpdateUserDto> }>,
): Promise<User[]> {
  return await this.dataSource.transaction(async (manager) => {
    const updatedUsers: User[] = [];
    for (const update of updates) {
      const user = await manager.findOne(User, { where: { id: update.id } });
      if (!user) {
        throw new NotFoundException(`User with ID ${update.id} not found`);
      }
      Object.assign(user, update.data);
      const updatedUser = await manager.save(User, user);
      updatedUsers.push(updatedUser);
    }
    return updatedUsers;
  });
}
```

**MikroORM**
```typescript
async bulkUpdateUsers(
  updates: Array<{ id: number; data: Partial<UpdateUserDto> }>,
): Promise<UserMikroOrm[]> {
  return await this.em.transactional(async (em) => {
    const updatedUsers: UserMikroOrm[] = [];
    for (const update of updates) {
      const user = await em.findOne(UserMikroOrm, { id: update.id });
      if (!user) {
        throw new NotFoundException(`User with ID ${update.id} not found`);
      }
      em.assign(user, update.data);
      updatedUsers.push(user);
    }
    await em.flush();
    return updatedUsers;
  });
}
```

## 3. 주요 차이점 요약

### 1. API 설계 철학
- **TypeORM**: Active Record와 Data Mapper 패턴 모두 지원
- **MikroORM**: Data Mapper 패턴에 집중, Unit of Work 패턴 구현

### 2. 영속성 관리
- **TypeORM**: `save()` 메서드로 즉시 저장
- **MikroORM**: `persist()` + `flush()` 패턴으로 변경사항 추적 및 일괄 저장

### 3. 트랜잭션 처리
- **TypeORM**: `dataSource.transaction()` 사용, 매니저 인스턴스 전달
- **MikroORM**: `em.transactional()` 사용, EntityManager 컨텍스트 자동 관리

### 4. 엔티티 업데이트
- **TypeORM**: `Object.assign()` 후 `save()` 호출
- **MikroORM**: `assign()` 메서드 제공, 자동 변경 감지

### 5. 쿼리 문법
- **TypeORM**: `{ where: { id } }` 형식
- **MikroORM**: `{ id }` 형식 (더 간결)

### 6. 성능 최적화
- **TypeORM**: 각 `save()` 호출마다 DB 쿼리
- **MikroORM**: `flush()` 시점에 모든 변경사항을 한 번에 처리 (Unit of Work)

## 4. 선택 기준

### TypeORM을 선택해야 할 때
- Active Record 패턴을 선호하는 경우
- 즉각적인 DB 반영이 필요한 경우
- 더 많은 커뮤니티 지원과 문서가 필요한 경우

### MikroORM을 선택해야 할 때
- Unit of Work 패턴과 변경 추적이 필요한 경우
- 더 나은 타입 안정성을 원하는 경우
- 복잡한 도메인 모델과 DDD 접근법을 사용하는 경우
- 성능 최적화가 중요한 경우 (배치 작업)

## 5. 마이그레이션 고려사항

TypeORM에서 MikroORM으로 전환 시:
1. 엔티티 데코레이터 변경 필요
2. Repository 메서드 호출 방식 변경
3. 트랜잭션 처리 로직 수정
4. `save()` → `persistAndFlush()` 패턴 변경
5. 쿼리 조건 문법 간소화 가능


>⚡ Active Record 패턴

“엔티티 스스로 DB에 접근한다.”

✅ 개념

엔티티 클래스 자체가 데이터 저장/조회 로직(save(), find(), remove())을 갖고 있음.

객체와 DB 레코드가 거의 1:1로 대응하며, DB 접근이 직관적임.

✅ 예시 (TypeORM의 Active Record 방식)
```
import { Entity, PrimaryGeneratedColumn, Column, BaseEntity } from 'typeorm';

@Entity()
export class User extends BaseEntity {
@PrimaryGeneratedColumn()
id!: number;

@Column()
name!: string;
}

// 사용 예시
const user = new User();
user.name = 'Jisu';
await user.save();            // 엔티티 자체가 DB에 저장됨
const users = await User.find();  // 클래스 메서드로 조회
```
✅ 장점

직관적이고 간단함 (특히 소규모 프로젝트에 적합)

모델 중심으로 빠르게 CRUD 가능

❌ 단점

비즈니스 로직과 DB 로직이 섞임

테스트, 유지보수, 확장성이 떨어짐 (특히 대형 서비스)

> 🧠 Data Mapper 패턴

“엔티티는 순수한 도메인 객체이고, DB 접근은 Repository가 담당한다.”

✅ 개념

엔티티는 데이터와 비즈니스 로직만 담당

데이터베이스 관련 CRUD는 Repository나 EntityManager가 수행

Unit of Work를 통해 변경 감지를 자동 관리 (MikroORM이 여기 강함)