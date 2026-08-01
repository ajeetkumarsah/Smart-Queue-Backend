import { Controller, Post, Body, HttpCode, HttpStatus, UseGuards, Request } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto } from './dto/auth.dto';
import { JwtAuthGuard } from './guards/jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    const data = await this.authService.register(dto);
    return {
      status: true,
      message: 'Registration successful',
      data,
      error: null,
    };
  }

  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(@Body() dto: LoginDto) {
    const data = await this.authService.login(dto);
    return {
      status: true,
      message: 'Login successful',
      data,
      error: null,
    };
  }

  @HttpCode(HttpStatus.OK)
  @Post('refresh')
  async refreshTokens(@Body('refresh_token') refreshToken: string) {
    const data = await this.authService.refreshTokens(refreshToken);
    return {
      status: true,
      message: 'Tokens refreshed successfully',
      data,
      error: null,
    };
  }

  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.OK)
  @Post('logout')
  async logout(@Request() req: any) {
    await this.authService.logout(req.user.id);
    return {
      status: true,
      message: 'Logged out successfully',
      data: null,
      error: null,
    };
  }
}

