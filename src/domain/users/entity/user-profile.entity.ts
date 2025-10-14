import { Entity, Column, PrimaryGeneratedColumn, OneToOne, JoinColumn } from 'typeorm';
import { User } from './user.entity';

// PostgreSQL의 객체 타입 활용 예제
interface Address {
  street: string;
  city: string;
  postalCode: string;
  country: string;
}

interface SocialLinks {
  linkedin?: string;
  twitter?: string;
  github?: string;
  website?: string;
}

interface Preferences {
  theme: 'light' | 'dark';
  language: string;
  notifications: {
    email: boolean;
    push: boolean;
    sms: boolean;
  };
  privacy: {
    profileVisible: boolean;
    emailVisible: boolean;
  };
}

@Entity('user_profiles')
export class UserProfile {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  userId: number;

  @OneToOne(() => User)
  @JoinColumn({ name: 'userId' })
  user: User;

  // JSON 객체로 주소 정보 저장
  @Column('jsonb', { nullable: true })
  homeAddress: Address;

  @Column('jsonb', { nullable: true })
  workAddress: Address;

  // 소셜 링크를 객체로 저장
  @Column('jsonb', { default: {} })
  socialLinks: SocialLinks;

  // 사용자 설정을 복잡한 객체로 저장
  @Column('jsonb', {
    default: {
      theme: 'light',
      language: 'ko',
      notifications: {
        email: true,
        push: true,
        sms: false,
      },
      privacy: {
        profileVisible: true,
        emailVisible: false,
      },
    },
  })
  preferences: Preferences;

  // 배열 타입 - 관심사/태그
  @Column('text', { array: true, default: '{}' })
  interests: string[];

  // 배열 타입 - 스킬 레벨 (1-5)
  @Column('int', { array: true, default: '{}' })
  skillLevels: number[];

  // JSON 배열 - 복잡한 객체들의 배열
  @Column('jsonb', { default: '[]' })
  workExperience: Array<{
    company: string;
    position: string;
    startDate: string;
    endDate?: string;
    description: string;
    technologies: string[];
  }>;

  @Column('jsonb', { default: '[]' })
  education: Array<{
    school: string;
    degree: string;
    major: string;
    graduationYear: number;
    gpa?: number;
  }>;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  createdAt: Date;

  @Column({ type: 'timestamp', default: () => 'CURRENT_TIMESTAMP' })
  updatedAt: Date;
}