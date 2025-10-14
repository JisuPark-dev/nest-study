import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { UserProfile } from '../entity/user-profile.entity';

@Injectable()
export class UserProfileService {
  constructor(
    @InjectRepository(UserProfile)
    private userProfileRepository: Repository<UserProfile>,
    private dataSource: DataSource,
  ) {}

  // JSONB 객체 필드로 검색하는 예제들
  async findUsersByCity(city: string): Promise<UserProfile[]> {
    return this.userProfileRepository.find({
      where: {
        homeAddress: {
          city: city, // JSONB 객체 내부 필드로 검색
        } as any,
      },
    });
  }

  // Raw SQL로 복잡한 JSONB 쿼리
  async findUsersWithComplexPreferences(): Promise<UserProfile[]> {
    const query = `
      SELECT * FROM user_profiles 
      WHERE preferences->>'theme' = 'dark'
        AND (preferences->'notifications'->>'email')::boolean = true
        AND jsonb_array_length(work_experience) > 2
    `;
    return this.dataSource.query(query);
  }

  // 배열 필드로 검색
  async findUsersByInterest(interest: string): Promise<UserProfile[]> {
    return this.userProfileRepository
      .createQueryBuilder('profile')
      .where(':interest = ANY(profile.interests)', { interest })
      .getMany();
  }

  // 특정 기술을 가진 사용자 검색 (JSONB 배열 내부 검색)
  async findUsersByTechnology(technology: string): Promise<UserProfile[]> {
    const query = `
      SELECT * FROM user_profiles 
      WHERE work_experience @> '[{"technologies": ["${technology}"]}]'
    `;
    return this.dataSource.query(query);
  }

  // 객체 필드 업데이트
  async updatePreferences(
    userId: number,
    preferences: Partial<any>,
  ): Promise<UserProfile> {
    return this.dataSource.transaction(async (manager) => {
      const profile = await manager.findOne(UserProfile, {
        where: { userId },
      });

      if (!profile) {
        throw new NotFoundException(`Profile for user ${userId} not found`);
      }

      // JSONB 필드 부분 업데이트
      profile.preferences = {
        ...profile.preferences,
        ...preferences,
      };

      return manager.save(UserProfile, profile);
    });
  }

  // 배열에 요소 추가
  async addInterest(userId: number, interest: string): Promise<UserProfile> {
    return this.dataSource.transaction(async (manager) => {
      const profile = await manager.findOne(UserProfile, {
        where: { userId },
      });

      if (!profile) {
        throw new NotFoundException(`Profile for user ${userId} not found`);
      }

      if (!profile.interests.includes(interest)) {
        profile.interests.push(interest);
      }

      return manager.save(UserProfile, profile);
    });
  }

  // 복잡한 객체 배열에 추가
  async addWorkExperience(
    userId: number,
    experience: {
      company: string;
      position: string;
      startDate: string;
      endDate?: string;
      description: string;
      technologies: string[];
    },
  ): Promise<UserProfile> {
    return this.dataSource.transaction(async (manager) => {
      const profile = await manager.findOne(UserProfile, {
        where: { userId },
      });

      if (!profile) {
        throw new NotFoundException(`Profile for user ${userId} not found`);
      }

      profile.workExperience.push(experience);

      return manager.save(UserProfile, profile);
    });
  }

  // PostgreSQL의 고급 JSONB 연산자 활용
  async getAdvancedProfileStats(): Promise<any[]> {
    const query = `
      SELECT 
        COUNT(*) as total_users,
        COUNT(CASE WHEN preferences->>'theme' = 'dark' THEN 1 END) as dark_theme_users,
        AVG(jsonb_array_length(interests)) as avg_interests_count,
        AVG(jsonb_array_length(work_experience)) as avg_work_experience_count,
        jsonb_object_agg(
          preferences->>'language', 
          COUNT(*)
        ) as language_distribution
      FROM user_profiles
      GROUP BY preferences->>'language'
    `;

    return this.dataSource.query(query);
  }
}