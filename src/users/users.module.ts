import { Module } from '@nestjs/common';
import { UsersService } from './users.service';
import { UsersRepository } from './users.repository';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';

import { UsersController } from './users.controller';

@Module({
  imports: [CloudinaryModule],
  controllers: [UsersController],
  providers: [UsersService, UsersRepository],
  exports: [UsersService, UsersRepository],
})
export class UsersModule {}
