import { Injectable, NotFoundException, ForbiddenException, BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { BusinessesRepository } from './businesses.repository';
import { CreateBusinessDto, UpdateBusinessDto } from './businesses.dto';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

@Injectable()
export class BusinessesService {
  constructor(
    private readonly businessesRepository: BusinessesRepository,
    private readonly cloudinaryService: CloudinaryService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  async create(ownerId: string, dto: CreateBusinessDto) {
    const existingBusinesses = await this.findMyBusinesses(ownerId);
    if (existingBusinesses.length >= 1) {
      const activeSubscription = await this.subscriptionsService.getActiveSubscription(ownerId);
      if (!activeSubscription) {
        throw new HttpException(
          'You have reached the limit of free businesses. Please subscribe to add more.',
          HttpStatus.PAYMENT_REQUIRED,
        );
      }
    }

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

  async delete(id: string, ownerId: string) {
    const business = await this.getById(id);
    if (business.owner_id !== ownerId) {
      throw new ForbiddenException('You do not have permission to delete this business');
    }
    const success = await this.businessesRepository.softDelete(id);
    if (!success) {
      throw new NotFoundException('Business could not be deleted');
    }
    return true;
  }

  async findMyBusinesses(userId: string) {
    return this.businessesRepository.findByUserId(userId);
  }

  async addOperator(businessId: string, ownerId: string, email: string) {
    const business = await this.getById(businessId);
    if (business.owner_id !== ownerId) {
      throw new ForbiddenException('Only the owner can add operators');
    }

    // find user by email
    const text = `SELECT * FROM users WHERE email = $1`;
    const res = await this.businessesRepository['pool'].query(text, [email]);
    let user = res.rows[0];

    if (!user) {
      throw new NotFoundException('User with this email not found. Please ask them to register first.');
    }

    if (user.role !== 'OPERATOR' && user.role !== 'BUSINESS_OWNER') {
      // update role to OPERATOR if they are CUSTOMER
      await this.businessesRepository['pool'].query(`UPDATE users SET role = 'OPERATOR' WHERE id = $1`, [user.id]);
    }

    // insert into business_operators
    try {
      await this.businessesRepository['pool'].query(
        `INSERT INTO business_operators (business_id, user_id) VALUES ($1, $2)`,
        [businessId, user.id]
      );
    } catch (e: any) {
      if (e.code === '23505') { // unique violation
        throw new BadRequestException('User is already an operator for this business');
      }
      throw e;
    }

    return { message: 'Operator added successfully' };
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
