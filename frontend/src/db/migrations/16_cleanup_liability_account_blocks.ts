import { MigrationInterface, QueryRunner } from 'typeorm';

export class CleanupLiabilityAccountBlocks1745000000016 implements MigrationInterface {
  name = 'CleanupLiabilityAccountBlocks1745000000016';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      WITH mapping(old_code, new_code) AS (
        VALUES
          ('0201110010', '0201100000'),
          ('0201120012', '0201100001'),
          ('0201130013', '0201100002'),
          ('0201140014', '0201100003'),
          ('0201150015', '0201100004'),
          ('0201210020', '0201200000'),
          ('0201220022', '0201200001'),
          ('0201230023', '0201200002'),
          ('0201240024', '0201200003'),
          ('0201310030', '0201300000'),
          ('0201320032', '0201300001'),
          ('0201330033', '0201300002'),
          ('0201340034', '0201300003')
      )
      UPDATE accounts a
      SET code = mapping.new_code
      FROM mapping
      WHERE a.code = mapping.old_code
        AND NOT EXISTS (
          SELECT 1
          FROM accounts existing
          WHERE existing.company_id = a.company_id
            AND existing.code = mapping.new_code
        )
    `);

    await queryRunner.query(`
      WITH mapping(old_code, new_code) AS (
        VALUES
          ('0201110010', '0201100000'),
          ('0201120012', '0201100001'),
          ('0201130013', '0201100002'),
          ('0201140014', '0201100003'),
          ('0201150015', '0201100004'),
          ('0201210020', '0201200000'),
          ('0201220022', '0201200001'),
          ('0201230023', '0201200002'),
          ('0201240024', '0201200003'),
          ('0201310030', '0201300000'),
          ('0201320032', '0201300001'),
          ('0201330033', '0201300002'),
          ('0201340034', '0201300003')
      )
      UPDATE voucher_lines v
      SET account_code = mapping.new_code
      FROM mapping
      WHERE v.account_code = mapping.old_code
    `);

    await queryRunner.query(`
      WITH mapping(old_code, new_code) AS (
        VALUES
          ('0201110010', '0201100000'),
          ('0201120012', '0201100001'),
          ('0201130013', '0201100002'),
          ('0201140014', '0201100003'),
          ('0201150015', '0201100004'),
          ('0201210020', '0201200000'),
          ('0201220022', '0201200001'),
          ('0201230023', '0201200002'),
          ('0201240024', '0201200003'),
          ('0201310030', '0201300000'),
          ('0201320032', '0201300001'),
          ('0201330033', '0201300002'),
          ('0201340034', '0201300003')
      )
      UPDATE coa_templates
      SET accounts = (
        SELECT jsonb_agg(
          CASE
            WHEN mapping.new_code IS NULL THEN elem
            ELSE jsonb_set(elem, '{code}', to_jsonb(mapping.new_code))
          END
          ORDER BY COALESCE(mapping.new_code, elem->>'code')
        )
        FROM jsonb_array_elements(accounts) elem
        LEFT JOIN mapping ON mapping.old_code = elem->>'code'
      )
      WHERE accounts IS NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      WITH mapping(new_code, old_code) AS (
        VALUES
          ('0201100000', '0201110010'),
          ('0201100001', '0201120012'),
          ('0201100002', '0201130013'),
          ('0201100003', '0201140014'),
          ('0201100004', '0201150015'),
          ('0201200000', '0201210020'),
          ('0201200001', '0201220022'),
          ('0201200002', '0201230023'),
          ('0201200003', '0201240024'),
          ('0201300000', '0201310030'),
          ('0201300001', '0201320032'),
          ('0201300002', '0201330033'),
          ('0201300003', '0201340034')
      )
      UPDATE accounts a
      SET code = mapping.old_code
      FROM mapping
      WHERE a.code = mapping.new_code
    `);
  }
}
