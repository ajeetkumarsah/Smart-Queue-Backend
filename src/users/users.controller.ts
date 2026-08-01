import { Controller, Get, Put, Body, UseGuards, Request, Post, UseInterceptors, UploadedFile, BadRequestException } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import { UsersService } from './users.service';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  @Get('me')
  async getProfile(@Request() req: any) {
    const user = await this.usersService.findById(req.user.id);
    return {
      status: true,
      message: 'Profile fetched successfully',
      data: user,
      error: null,
    };
  }

  @Put('me')
  async updateProfile(@Request() req: any, @Body() dto: UpdateProfileDto) {
    const user = await this.usersService.updateProfile(req.user.id, dto);
    return {
      status: true,
      message: 'Profile updated successfully',
      data: user,
      error: null,
    };
  }

  @Post('me/avatar')
  @UseInterceptors(FileInterceptor('file', {
    storage: memoryStorage(),
  }))
  async uploadAvatar(@Request() req: any, @UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    
    // Upload image to Cloudinary
    const avatarUrl = await this.cloudinaryService.uploadImage(file, 'smart_queue_avatars');
    
    // Update the user in the database
    const user = await this.usersService.updateProfile(req.user.id, { avatar_url: avatarUrl });
    
    return {
      status: true,
      message: 'Avatar uploaded successfully',
      data: user,
      error: null,
    };
  }
}

