import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { User } from '../entity/user.entity';
import { CreateUserDto } from '../dto/create-user.dto';
import { UpdateUserDto } from '../dto/update-user.dto';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private dataSource: DataSource,
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    const user = this.usersRepository.create(createUserDto);
    return await this.usersRepository.save(user);
  }

  async findAll(): Promise<User[]> {
    return await this.usersRepository.find();
  }

  async findOne(id: number): Promise<User> {
    const user = await this.usersRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

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

  async remove(id: number): Promise<void> {
    await this.dataSource.transaction(async (manager) => {
      const user = await manager.findOne(User, { where: { id } });
      if (!user) {
        throw new NotFoundException(`User with ID ${id} not found`);
      }

      await manager.remove(User, user);
    });
  }

  async updateUserWithRelatedData(
    id: number,
    updateUserDto: UpdateUserDto,
    additionalOperations?: () => Promise<void>,
  ): Promise<User> {
    return await this.dataSource.transaction(async (manager) => {
      const user = await manager.findOne(User, { where: { id } });
      if (!user) {
        throw new NotFoundException(`User with ID ${id} not found`);
      }

      Object.assign(user, updateUserDto);
      const updatedUser = await manager.save(User, user);

      if (additionalOperations) {
        await additionalOperations();
      }

      return updatedUser;
    });
  }

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

  async deactivateUser(id: number): Promise<User> {
    return await this.dataSource.transaction(async (manager) => {
      const user = await manager.findOne(User, { where: { id } });
      if (!user) {
        throw new NotFoundException(`User with ID ${id} not found`);
      }

      user.isActive = false;
      return await manager.save(User, user);
    });
  }

  async transferUserData(
    fromUserId: number,
    toUserId: number,
  ): Promise<{ fromUser: User; toUser: User }> {
    return await this.dataSource.transaction(async (manager) => {
      const fromUser = await manager.findOne(User, {
        where: { id: fromUserId },
      });
      const toUser = await manager.findOne(User, { where: { id: toUserId } });

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

      const updatedFromUser = await manager.save(User, fromUser);
      const updatedToUser = await manager.save(User, toUser);

      return { fromUser: updatedFromUser, toUser: updatedToUser };
    });
  }
}
