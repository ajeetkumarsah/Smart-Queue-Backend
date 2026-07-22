import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../database/base.repository';
import { ServiceEntity } from './service.entity';

@Injectable()
export class ServicesRepository extends BaseRepository<ServiceEntity> {
  protected readonly tableName = 'services';

  async findByBusinessId(businessId: string): Promise<ServiceEntity[]> {
    return this.query(\`SELECT * FROM \${this.tableName} WHERE business_id = $1 AND deleted_at IS NULL\`, [businessId]);
  }
}
