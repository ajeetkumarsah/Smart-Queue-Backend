import { Controller, Get, Put, Body, UseGuards, Request, Post, UseInterceptors, UploadedFile } from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { UsersService } from './users.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { UpdateProfileDto } from './dto/update-profile.dto';

@Controller('users')
@UseGuards(JwtAuthGuard)
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

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
    storage: diskStorage({
      destination: './uploads/avatars',
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = extname(file.originalname);
        cb(null, `${req.user['id']}-${uniqueSuffix}${ext}`);
      },
    }),
  }))
  async uploadAvatar(@Request() req: any, @UploadedFile() file: Express.Multer.File) {
    if (!file) {
      return { status: false, message: 'No file uploaded', data: null, error: 'File is required' };
    }
    
    // In a real app, this would be a full URL (e.g., S3 URL or domain + path).
    // For local testing, we return the relative path or mock URL.
    const avatarUrl = `/uploads/avatars/${file.filename}`;
    
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

