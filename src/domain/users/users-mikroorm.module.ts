import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { UserMikroOrm } from './entity/user.mikroorm.entity';
import { UsersServiceV2 } from './service/users.service.v2';

@Module({
  imports: [MikroOrmModule.forFeature([UserMikroOrm])],
  providers: [UsersServiceV2],
  exports: [UsersServiceV2],
})
export class UsersMikroOrmModule {}