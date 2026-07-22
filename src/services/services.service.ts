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
}
