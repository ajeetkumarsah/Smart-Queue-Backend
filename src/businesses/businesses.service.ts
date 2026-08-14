import { Injectable, NotFoundException, ForbiddenException, BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { BusinessesRepository } from './businesses.repository';
import { CreateBusinessDto, UpdateBusinessDto } from './businesses.dto';
import { CloudinaryService } from '../cloudinary/cloudinary.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { extractLocationFromMapsUrl } from '../utils/location.utils';

@Injectable()
export class BusinessesService {
  constructor(
    private readonly businessesRepository: BusinessesRepository,
    private readonly cloudinaryService: CloudinaryService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  async create(ownerId: string, dto: CreateBusinessDto) {
    const existingBusinesses = await this.findMyBusinesses(ownerId);
    const activeSubscription = await this.subscriptionsService.getActiveSubscription(ownerId);
    
    // Default limit if no active premium plan is found
    const maxBusinesses = activeSubscription ? activeSubscription.max_businesses : 1;

    if (existingBusinesses.length >= maxBusinesses) {
      throw new HttpException(
        `You have reached your limit of ${maxBusinesses} business(es). Please upgrade your subscription to add more.`,
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    let lat = dto.latitude;
    let lng = dto.longitude;

    if (dto.maps_link) {
      const loc = await extractLocationFromMapsUrl(dto.maps_link);
      if (loc) {
        lat = loc.latitude;
        lng = loc.longitude;
      }
    }

    return this.businessesRepository.create({
      owner_id: ownerId,
      name: dto.name,
      description: dto.description,
      address: dto.address,
      phone: dto.phone,
      latitude: lat,
      longitude: lng,
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

    const activeSubscription = await this.subscriptionsService.getActiveSubscription(ownerId);
    if (!activeSubscription || activeSubscription.plan_type === 'BASIC') {
      throw new HttpException(
        'Your premium plan has expired. Editing is restricted on the Basic plan. Please upgrade to edit or update your business.',
        HttpStatus.PAYMENT_REQUIRED,
      );
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
