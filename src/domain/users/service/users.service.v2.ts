import { Injectable, NotFoundException } from '@nestjs/common';
import { EntityManager, EntityRepository } from '@mikro-orm/core';
import { InjectRepository } from '@mikro-orm/nestjs';
import { UserMikroOrm } from '../entity/user.mikroorm.entity';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';

@Injectable()
export class UsersServiceV2 {
  constructor(
    @InjectRepository(UserMikroOrm)
    private readonly usersRepository: EntityRepository<UserMikroOrm>,
    private readonly em: EntityManager,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<UserMikroOrm> {
    const user = this.usersRepository.create(createUserDto);
    await this.em.persistAndFlush(user);
    return user;
  }

  async findAll(): Promise<UserMikroOrm[]> {
    return await this.usersRepository.findAll();
  }

  async findOne(id: number): Promise<UserMikroOrm> {
    const user = await this.usersRepository.findOne({ id });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  async update(id: number, updateUserDto: UpdateUserDto): Promise<UserMikroOrm> {
    const user = await this.usersRepository.findOne({ id });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    this.usersRepository.assign(user, updateUserDto);
    await this.em.flush();
    return user;
  }

  async remove(id: number): Promise<void> {
    const user = await this.usersRepository.findOne({ id });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    await this.em.removeAndFlush(user);
  }

  async updateUserWithRelatedData(
    id: number,
    updateUserDto: UpdateUserDto,
    additionalOperations?: () => Promise<void>,
  ): Promise<UserMikroOrm> {
    return await this.em.transactional(async (em) => {
      const user = await em.findOne(UserMikroOrm, { id });
      if (!user) {
        throw new NotFoundException(`User with ID ${id} not found`);
      }

      em.assign(user, updateUserDto);
      await em.flush();

      if (additionalOperations) {
        await additionalOperations();
      }

      return user;
    });
  }

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

  async deactivateUser(id: number): Promise<UserMikroOrm> {
    return await this.em.transactional(async (em) => {
      const user = await em.findOne(UserMikroOrm, { id });
      if (!user) {
        throw new NotFoundException(`User with ID ${id} not found`);
      }

      user.isActive = false;
      await em.flush();
      return user;
    });
  }

  async transferUserData(
    fromUserId: number,
    toUserId: number,
  ): Promise<{ fromUser: UserMikroOrm; toUser: UserMikroOrm }> {
    return await this.em.transactional(async (em) => {
      const fromUser = await em.findOne(UserMikroOrm, { id: fromUserId });
      const toUser = await em.findOne(UserMikroOrm, { id: toUserId });

      if (!fromUser) {
        throw new NotFoundException(
          `Source user with ID ${fromUserId} not found`,
        );
      }
      if (!toUser) {
        throw new NotFoundException(
          `Target user with ID ${toUserId} not found`,
        );
      }

      fromUser.isActive = false;
      await em.flush();

      return { fromUser, toUser };
    });
  }
}