import {
  Repository,
  FindOptionsWhere,
  FindOptionsRelations,
  EntityManager,
} from 'typeorm';
import { BaseEntity } from './base.entity';

/**
 * Base repository for all ERP repositories.
 * Uses composition (holds a Repository<T>) instead of extending it.
 * Automatically filters by company_id on all queries.
 */
export abstract class BaseRepository<T extends BaseEntity> {
  protected repository: Repository<T>;
  protected companyId!: string;

  constructor(repository: Repository<T>) {
    this.repository = repository;
  }

  /** Set company ID for query scoping */
  setCompanyId(companyId: string): void {
    this.companyId = companyId;
  }

  /** Access the entity manager for complex queries */
  get manager(): EntityManager {
    return this.repository.manager;
  }

  /** Create a query builder scoped to the entity */
  createQueryBuilder(alias: string) {
    return this.repository.createQueryBuilder(alias);
  }

  /** Find one entity by ID, scoped to current company */
  async findOneById(
    id: string,
    relations?: FindOptionsRelations<T>,
  ): Promise<T | null> {
    return this.repository.findOne({
      where: {
        id: id as any,
        company_id: this.companyId as any,
        is_deleted: false as any,
      } as FindOptionsWhere<T>,
      relations,
    });
  }

  /** Find one entity with custom where clause */
  async findOne(options: { where: FindOptionsWhere<T>; relations?: FindOptionsRelations<T> }): Promise<T | null> {
    return this.repository.findOne(options);
  }

  /** Find all entities in current company (non-deleted) */
  async findAllInCompany(
    where?: FindOptionsWhere<T>,
    relations?: FindOptionsRelations<T>,
  ): Promise<T[]> {
    return this.repository.find({
      where: {
        ...where,
        company_id: this.companyId as any,
        is_deleted: false as any,
      } as FindOptionsWhere<T>,
      relations,
    });
  }

  /** Find entities with raw options */
  async find(options: {
    where?: FindOptionsWhere<T> | FindOptionsWhere<T>[];
    relations?: FindOptionsRelations<T>;
    order?: any;
    skip?: number;
    take?: number;
  }): Promise<T[]> {
    return this.repository.find(options);
  }

  /** Find entities with pagination */
  async findWithPagination(
    page: number = 1,
    limit: number = 20,
    where?: FindOptionsWhere<T>,
  ): Promise<[T[], number]> {
    return this.repository.findAndCount({
      where: {
        ...where,
        company_id: this.companyId as any,
        is_deleted: false as any,
      } as FindOptionsWhere<T>,
      skip: (page - 1) * limit,
      take: limit,
    });
  }

  /** Create entity with company_id automatically set */
  async createEntity(data: Partial<T>): Promise<T> {
    const entity = this.repository.create({
      ...data,
      company_id: this.companyId,
    } as any);
    return this.repository.save(entity as any) as unknown as T;
  }

  /** Save an entity */
  async save(entity: T): Promise<T> {
    return this.repository.save(entity as any) as unknown as T;
  }

  /** Update entities matching criteria */
  async update(
    where: FindOptionsWhere<T>,
    data: Partial<T>,
  ): Promise<void> {
    await this.repository.update(where, data as any);
  }

  /** Soft delete: mark as deleted without removing from DB */
  async markAsDeleted(id: string, deletedByUserId?: string): Promise<void> {
    await this.repository.update(
      {
        id: id as any,
        company_id: this.companyId as any,
      } as FindOptionsWhere<T>,
      {
        is_deleted: true as any,
        deleted_at: new Date() as any,
        deleted_by_user_id: deletedByUserId as any,
      } as any,
    );
  }

  /** Restore soft-deleted entity */
  async unmarkAsDeleted(id: string): Promise<void> {
    await this.repository.update(
      {
        id: id as any,
        company_id: this.companyId as any,
      } as FindOptionsWhere<T>,
      {
        is_deleted: false as any,
        deleted_at: null as any,
        deleted_by_user_id: null as any,
      } as any,
    );
  }

  /** Count entities in current company */
  async countInCompany(where?: FindOptionsWhere<T>): Promise<number> {
    return this.repository.count({
      where: {
        ...where,
        company_id: this.companyId as any,
        is_deleted: false as any,
      } as FindOptionsWhere<T>,
    });
  }

  /** Count with raw options */
  async count(options?: { where?: FindOptionsWhere<T> }): Promise<number> {
    return this.repository.count(options);
  }

  /** Check if entity exists in current company */
  async existsInCompany(where: FindOptionsWhere<T>): Promise<boolean> {
    const count = await this.repository.count({
      where: {
        ...where,
        company_id: this.companyId as any,
        is_deleted: false as any,
      } as FindOptionsWhere<T>,
    });
    return count > 0;
  }
}
