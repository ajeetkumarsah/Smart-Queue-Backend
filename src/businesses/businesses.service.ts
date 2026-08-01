import { Injectable, NotFoundException, ForbiddenException, BadRequestException } from '@nestjs/common';
import { BusinessesRepository } from './businesses.repository';
import { CreateBusinessDto, UpdateBusinessDto } from './businesses.dto';
import { CloudinaryService } from '../cloudinary/cloudinary.service';

@Injectable()
export class BusinessesService {
  constructor(
    private readonly businessesRepository: BusinessesRepository,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

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

  async uploadLogo(id: string, ownerId: string, file: Express.Multer.File) {
    const business = await this.getById(id);
    if (business.owner_id !== ownerId) {
      throw new ForbiddenException('You do not have permission to edit this business');
    }
    if (!file) {
      throw new BadRequestException('File is required');
    }

    const logoUrl = await this.cloudinaryService.uploadImage(file, 'smart_queue_business_logos');
    
    const updated = await this.businessesRepository.update(id, { logo_url: logoUrl });
    if (!updated) {
      throw new NotFoundException('Business could not be updated');
    }
    return updated;
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
