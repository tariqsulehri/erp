import { AppDataSource } from '@/db/data-source';
import { CostCenter, Department, Project } from './transaction-support.entity';

type MasterKind = 'costCenter' | 'project' | 'department';

const masterEntity = {
  costCenter: CostCenter,
  project: Project,
  department: Department,
} as const;

export class TransactionSupportService {
  constructor(private companyId: string) {}

  async list(kind: MasterKind, search?: string) {
    const repo = AppDataSource.getRepository(masterEntity[kind]);
    const qb = repo
      .createQueryBuilder('m')
      .where('m.company_id = :companyId', { companyId: this.companyId })
      .andWhere('m.is_active = true');

    if (search?.trim()) {
      qb.andWhere('(m.code ILIKE :search OR m.name ILIKE :search)', { search: `%${search.trim()}%` });
    }

    return qb
      .orderBy('m.code', 'ASC')
      .addOrderBy('m.name', 'ASC')
      .limit(200)
      .getMany();
  }

  async validateActiveIds(kind: MasterKind, ids: string[], label: string) {
    const uniqueIds = [...new Set(ids.filter(Boolean))];
    if (uniqueIds.length === 0) return;

    const repo = AppDataSource.getRepository(masterEntity[kind]);
    const count = await repo
      .createQueryBuilder('m')
      .where('m.company_id = :companyId', { companyId: this.companyId })
      .andWhere('m.is_active = true')
      .andWhere('m.id IN (:...ids)', { ids: uniqueIds })
      .getCount();

    if (count !== uniqueIds.length) {
      throw new Error(`${label} was not found or is inactive. Please select it again.`);
    }
  }
}
