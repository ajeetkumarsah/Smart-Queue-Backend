import { Injectable, NotFoundException } from '@nestjs/common';
import { BusinessesRepository } from './businesses.repository';
import { CreateBusinessDto } from './businesses.dto';

@Injectable()
export class BusinessesService {
  constructor(private readonly businessesRepository: BusinessesRepository) {}

  async create(ownerId: string, dto: CreateBusinessDto) {
    return this.businessesRepository.create({
      owner_id: ownerId,
      name: dto.name,
      description: dto.description,
      address: dto.address,
      phone: dto.phone,
      is_active: true,
      is_verified: false,
    });
  }

  async findMyBusinesses(ownerId: string) {
    return this.businessesRepository.findByOwnerId(ownerId);
  }

  async searchBusinesses(term: string) {
    return this.businessesRepository.search(term);
  }

  async getById(id: string) {
    const business = await this.businessesRepository.findById(id);
    if (!business) {
      throw new NotFoundException('Business not found');
    }
    return business;
  }
}
