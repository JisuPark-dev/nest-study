import { Module } from '@nestjs/common';
import { MikroOrmModule } from '@mikro-orm/nestjs';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { UserMikroOrm } from './entity/user.mikroorm.entity';

@Module({
  imports: [
    MikroOrmModule.forRootAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        entities: [UserMikroOrm],
        dbName: configService.get('POSTGRES_DB', 'app'),
        type: 'postgresql',
        host: configService.get('POSTGRES_HOST', 'localhost'),
        port: configService.get('POSTGRES_PORT', 5432),
        user: configService.get('POSTGRES_USER', 'root'),
        password: configService.get('POSTGRES_PASSWORD', '1234'),
        allowGlobalContext: true,
        debug: configService.get('NODE_ENV') === 'development',
      }),
      inject: [ConfigService],
    }),
  ],
})
export class MikroOrmRootModule {}