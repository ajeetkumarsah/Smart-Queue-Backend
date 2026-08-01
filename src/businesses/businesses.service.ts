import { Injectable, NotFoundException, ForbiddenException } from '@nestjs/common';
import { BusinessesRepository } from './businesses.repository';
import { CreateBusinessDto, UpdateBusinessDto } from './businesses.dto';

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
      latitude: dto.latitude,
      longitude: dto.longitude,
      is_active: true,
      is_verified: false,
    });
  }

  async update(id: string, ownerId: string, dto: UpdateBusinessDto) {
    const business = await this.getById(id);
    if (business.owner_id !== ownerId) {
      throw new ForbiddenException('You do not have permission to edit this business');
    }
    const updated = await this.businessesRepository.update(id, dto);
    if (!updated) {
      throw new NotFoundException('Business could not be updated');
    }
    return updated;
  }

  async findMyBusinesses(ownerId: string) {
    return this.businessesRepository.findByOwnerId(ownerId);
  }

  async searchBusinesses(term: string, category?: string) {
    return this.businessesRepository.search(term, category);
  }

  async getNearbyBusinesses(lat: number, lng: number, radiusKm = 50, category?: string) {
    return this.businessesRepository.findNearby(lat, lng, radiusKm, category);
  }

  async getById(id: string) {
    const business = await this.businessesRepository.findById(id);
    if (!business) {
      throw new NotFoundException('Business not found');
    }
    return business;
  }
}
