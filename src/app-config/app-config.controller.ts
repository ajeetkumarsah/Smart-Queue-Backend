import { Controller, Get, Param } from '@nestjs/common';
import { AppConfigService } from './app-config.service';

@Controller('app-config')
export class AppConfigController {
  constructor(private readonly appConfigService: AppConfigService) {}

  @Get('contact')
  getContactInfo() {
    return {
      status: true,
      message: 'Contact info retrieved successfully',
      data: this.appConfigService.getContactInfo(),
      error: null,
    };
  }

  @Get('static-content/:type')
  getStaticContent(@Param('type') type: string) {
    const data = this.appConfigService.getStaticContent(type);
    return {
      status: true,
      message: 'Static content retrieved successfully',
      data,
      error: null,
    };
  }
}
