import { Injectable, NotFoundException } from '@nestjs/common';
import { PlansRepository } from './plans.repository';
import { PlanEntity } from './plans.entity';

@Injectable()
export class PlansService {
  constructor(private readonly plansRepository: PlansRepository) {}

  async getActivePlans(): Promise<PlanEntity[]> {
    return this.plansRepository.findActivePlans();
  }

  async getAllPlans(): Promise<PlanEntity[]> {
    // Admin uses this to see all plans, including inactive
    return this.plansRepository.findAll();
  }

  async createPlan(data: Partial<PlanEntity>): Promise<PlanEntity> {
    return this.plansRepository.createPlan(data);
  }

  async updatePlan(id: string, data: Partial<PlanEntity>): Promise<PlanEntity> {
    const plan = await this.plansRepository.findById(id);
    if (!plan) {
      throw new NotFoundException('Plan not found');
    }
    return this.plansRepository.updatePlan(id, data);
  }

  async deletePlan(id: string): Promise<void> {
    const plan = await this.plansRepository.findById(id);
    if (!plan) {
      throw new NotFoundException('Plan not found');
    }
    await this.plansRepository.deletePlan(id);
  }
}
