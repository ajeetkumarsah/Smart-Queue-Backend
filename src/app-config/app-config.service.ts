import { Injectable, NotFoundException } from '@nestjs/common';

@Injectable()
export class AppConfigService {
  getStaticContent(type: string) {
    switch (type.toLowerCase()) {
      case 'faq':
        return {
          title: 'Frequently Asked Questions',
          content:
            'Here are some frequently asked questions.\n\n1. How do I join a queue?\nNavigate to a business and tap "Join Queue".\n\n2. How do I manage my business?\nGo to your Profile and tap "Business Dashboard".',
        };
      case 'terms':
        return {
          title: 'Terms of Service',
          content:
            'By using SmartQueue, you agree to these terms.\n\n1. You will not abuse the platform.\n2. You are responsible for your own data.\n\nEffective Date: January 1, 2026.',
        };
      case 'policy':
        return {
          title: 'User Policy',
          content:
            'Our User Policy outlines acceptable behavior on the platform.\n\nRespect others and do not spam queues. Business owners reserve the right to remove you from their queue.',
        };
      default:
        throw new NotFoundException('Content type not found');
    }
  }

  getContactInfo() {
    return {
      email: 'anishkrshaw@gmail.com',
      phone: '+918981469412',
      website: 'https://rentpecars.com',
    };
  }
}
