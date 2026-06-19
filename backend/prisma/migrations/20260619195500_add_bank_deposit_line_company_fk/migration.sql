ALTER TABLE "bank_deposit_lines"
  ADD CONSTRAINT "bank_deposit_lines_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
