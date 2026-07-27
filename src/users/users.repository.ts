import { Injectable } from '@nestjs/common';
import { BaseRepository } from '../database/base.repository';
import { UserEntity } from './user.entity';

@Injectable()
export class UsersRepository extends BaseRepository<UserEntity> {
  protected readonly tableName = 'users';

  async findByEmail(email: string): Promise<UserEntity | null> {
    const text = `SELECT * FROM ${this.tableName} WHERE email = $1 AND deleted_at IS NULL`;
    return this.queryOne(text, [email]);
  }

  async createUser(user: Partial<UserEntity>): Promise<UserEntity> {
    const text = `
      INSERT INTO ${this.tableName} (email, password_hash, full_name, phone, role)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const values = [
      user.email,
      user.password_hash,
      user.full_name,
      user.phone,
      user.role || 'CUSTOMER',
    ];
    const result = await this.queryOne(text, values);
    return result;
  }
}
