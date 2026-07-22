import { IsString, IsOptional, IsNumber, IsUUID } from 'class-validator';

export class CreateServiceDto {
  @IsUUID()
  business_id: string;

  @IsString()
  name: string;

  @IsString()
  @IsOptional()
  description?: string;

  @IsNumber()
  estimated_wait_time_mins: number;

  @IsNumber()
  @IsOptional()
  max_queue_size?: number;
}
