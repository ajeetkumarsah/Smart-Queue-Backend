import { Injectable, ForbiddenException } from '@nestjs/common';
import { ServicesRepository } from './services.repository';
import { BusinessesService } from '../businesses/businesses.service';
import { CreateServiceDto } from './services.dto';

@Injectable()
export class ServicesService {
  constructor(
    private readonly servicesRepository: ServicesRepository,
    private readonly businessesService: BusinessesService,
  ) {}

  async create(ownerId: string, dto: CreateServiceDto) {
    // Verify business belongs to owner
    const business = await this.businessesService.getById(dto.business_id);
    if (business.owner_id !== ownerId) {
      throw new ForbiddenException('You do not own this business');
    }
    if (!business.is_verified) {
      throw new ForbiddenException('Your business is not verified. You cannot perform this action.');
    }

    return this.servicesRepository.create({
      business_id: dto.business_id,
      name: dto.name,
      description: dto.description,
      estimated_wait_time_mins: dto.estimated_wait_time_mins,
      max_queue_size: dto.max_queue_size,
      is_active: true,
    });
  }

  async findByBusinessId(businessId: string) {
    return this.servicesRepository.findByBusinessId(businessId);
  }

  async updateStatus(ownerId: string, serviceId: string, isActive: boolean) {
    const service = await this.servicesRepository.findById(serviceId);
    if (!service) {
      throw new ForbiddenException('Service not found');
    }
    const business = await this.businessesService.getById(service.business_id);
    if (business.owner_id !== ownerId) {
      throw new ForbiddenException('You do not own this business');
    }
    if (!business.is_verified) {
      throw new ForbiddenException('Your business is not verified. You cannot perform this action.');
    }
    return this.servicesRepository.updateStatus(serviceId, isActive);
  }
}
