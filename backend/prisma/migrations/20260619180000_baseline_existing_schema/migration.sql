--
-- PostgreSQL database dump
--

-- Dumped from database version 17.5 (Homebrew)
-- Dumped by pg_dump version 17.5 (Homebrew)

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA public;

CREATE OR REPLACE FUNCTION public.trg_set_updated_at()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $function$;

--
-- Name: account_audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    account_id uuid NOT NULL,
    company_id uuid NOT NULL,
    changed_by character varying(255),
    action character varying(50) NOT NULL,
    changes jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: account_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.account_categories (
    category_code character varying(1) NOT NULL,
    name character varying(50) NOT NULL,
    normal_balance character varying(10) DEFAULT 'Debit'::character varying NOT NULL,
    description text,
    sort_order integer DEFAULT 0 NOT NULL
);


--
-- Name: accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.accounts (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    company_id uuid NOT NULL,
    code character varying(10) NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    account_type character varying(50) NOT NULL,
    normal_balance character varying(10) NOT NULL,
    is_posting boolean DEFAULT false NOT NULL,
    is_system boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0,
    category_id uuid,
    tax_codes jsonb,
    attributes jsonb,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by_user_id uuid,
    updated_by_user_id uuid,
    audit_metadata jsonb,
    is_deleted boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by_user_id uuid,
    opening_balance numeric(15,2),
    opening_balance_date date,
    CONSTRAINT "CHK_accounts_code_6to10digit" CHECK (((code)::text ~ '^[0-9]{6,10}$'::text))
);


--
-- Name: coa_templates; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coa_templates (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    template_code character varying(50) NOT NULL,
    template_name character varying(100) NOT NULL,
    description text,
    accounts jsonb NOT NULL,
    account_count integer NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: companies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.companies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    group_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    registration_number character varying(20),
    tax_id character varying(50),
    currency_code character varying(3) DEFAULT 'PKR'::character varying,
    address character varying(200),
    city character varying(100),
    country character varying(100),
    phone character varying(20),
    email character varying(100),
    fiscal_year_basis character varying(50) DEFAULT 'calendar'::character varying NOT NULL,
    number_of_periods integer DEFAULT 12 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: company_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.company_groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    registration_number character varying(20),
    parent_company character varying(100),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: customers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.customers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    code character varying(20) NOT NULL,
    name character varying(200) NOT NULL,
    trade_name character varying(200),
    customer_type character varying(20) DEFAULT 'company'::character varying NOT NULL,
    tax_registration_no character varying(50),
    email character varying(200),
    phone character varying(30),
    mobile character varying(30),
    billing_address text,
    shipping_address text,
    city character varying(100),
    country character varying(100),
    postal_code character varying(20),
    payment_terms_days smallint DEFAULT 30 NOT NULL,
    credit_limit numeric(18,2) DEFAULT 0 NOT NULL,
    currency_code character(3) DEFAULT 'USD'::bpchar NOT NULL,
    ar_account_id uuid,
    advance_account_id uuid,
    is_active boolean DEFAULT true NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_customer_currency CHECK ((char_length(currency_code) = 3)),
    CONSTRAINT chk_customer_limit CHECK ((credit_limit >= (0)::numeric)),
    CONSTRAINT chk_customer_terms CHECK (((payment_terms_days >= 0) AND (payment_terms_days <= 365))),
    CONSTRAINT chk_customer_type CHECK (((customer_type)::text = ANY ((ARRAY['individual'::character varying, 'company'::character varying, 'government'::character varying])::text[])))
);


--
-- Name: fiscal_periods; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fiscal_periods (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    company_id uuid NOT NULL,
    fiscal_year_id uuid NOT NULL,
    period_number integer NOT NULL,
    period_name character varying(100) NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    status character varying(20) DEFAULT 'open'::character varying NOT NULL,
    is_open boolean DEFAULT true NOT NULL,
    is_locked boolean DEFAULT false NOT NULL,
    locked_at timestamp with time zone,
    locked_by_user_id uuid,
    posting_cutoff_days integer NOT NULL,
    transaction_count integer DEFAULT 0 NOT NULL,
    total_debits numeric(18,2) DEFAULT 0 NOT NULL,
    total_credits numeric(18,2) DEFAULT 0 NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by_user_id uuid,
    updated_by_user_id uuid,
    audit_metadata jsonb,
    is_deleted boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by_user_id uuid
);


--
-- Name: COLUMN fiscal_periods.fiscal_year_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.fiscal_periods.fiscal_year_id IS 'Parent fiscal year';


--
-- Name: COLUMN fiscal_periods.period_number; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.fiscal_periods.period_number IS 'Sequence 1-12 (or more for non-monthly)';


--
-- Name: COLUMN fiscal_periods.period_name; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.fiscal_periods.period_name IS 'Display name: "January 2025", "Feb", "Period 1"';


--
-- Name: COLUMN fiscal_periods.start_date; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.fiscal_periods.start_date IS 'First day of period (inclusive)';


--
-- Name: COLUMN fiscal_periods.end_date; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.fiscal_periods.end_date IS 'Last day of period (inclusive)';


--
-- Name: COLUMN fiscal_periods.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.fiscal_periods.status IS 'open | locked | closed';


--
-- Name: COLUMN fiscal_periods.is_open; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.fiscal_periods.is_open IS 'Can transactions be posted?';


--
-- Name: COLUMN fiscal_periods.is_locked; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.fiscal_periods.is_locked IS 'Month-end closing flag';


--
-- Name: COLUMN fiscal_periods.locked_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.fiscal_periods.locked_at IS 'When period was locked';


--
-- Name: COLUMN fiscal_periods.locked_by_user_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.fiscal_periods.locked_by_user_id IS 'User who locked the period';


--
-- Name: COLUMN fiscal_periods.posting_cutoff_days; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.fiscal_periods.posting_cutoff_days IS 'Days after period end to allow posting';


--
-- Name: COLUMN fiscal_periods.transaction_count; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.fiscal_periods.transaction_count IS 'Cached count of transactions in period';


--
-- Name: COLUMN fiscal_periods.total_debits; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.fiscal_periods.total_debits IS 'Sum of debits in this period';


--
-- Name: COLUMN fiscal_periods.total_credits; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.fiscal_periods.total_credits IS 'Sum of credits in this period';


--
-- Name: fiscal_years; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fiscal_years (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    company_id uuid NOT NULL,
    fiscal_year character varying(50) NOT NULL,
    year_basis character varying(20) DEFAULT 'calendar'::character varying NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    number_of_periods integer DEFAULT 12 NOT NULL,
    period_type character varying(20) DEFAULT 'monthly'::character varying NOT NULL,
    posting_cutoff_days integer DEFAULT 0 NOT NULL,
    status character varying(20) DEFAULT 'open'::character varying NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    is_locked boolean DEFAULT false NOT NULL,
    locked_at timestamp with time zone,
    locked_by_user_id uuid,
    closing_started_at timestamp with time zone,
    closing_completed_at timestamp with time zone,
    transaction_count integer DEFAULT 0 NOT NULL,
    total_debits numeric(18,2) DEFAULT 0 NOT NULL,
    total_credits numeric(18,2) DEFAULT 0 NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    created_by_user_id uuid,
    updated_by_user_id uuid,
    audit_metadata jsonb,
    is_deleted boolean DEFAULT false NOT NULL,
    deleted_at timestamp with time zone,
    deleted_by_user_id uuid
);


--
-- Name: COLUMN fiscal_years.fiscal_year; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.fiscal_years.fiscal_year IS 'Human-readable identifier (e.g., "2025", "2025-2026")';


--
-- Name: COLUMN fiscal_years.year_basis; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.fiscal_years.year_basis IS 'Calendar structure: calendar, july, april';


--
-- Name: COLUMN fiscal_years.start_date; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.fiscal_years.start_date IS 'First day of fiscal year (inclusive)';


--
-- Name: COLUMN fiscal_years.end_date; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.fiscal_years.end_date IS 'Last day of fiscal year (inclusive)';


--
-- Name: COLUMN fiscal_years.number_of_periods; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.fiscal_years.number_of_periods IS 'Usually 12 for monthly, can be 13, 52, etc.';


--
-- Name: COLUMN fiscal_years.period_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.fiscal_years.period_type IS 'monthly, quarterly, weekly, etc.';


--
-- Name: COLUMN fiscal_years.posting_cutoff_days; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.fiscal_years.posting_cutoff_days IS 'Days after period end to allow posting';


--
-- Name: COLUMN fiscal_years.status; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.fiscal_years.status IS 'open | closing | closed | archived';


--
-- Name: COLUMN fiscal_years.is_active; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.fiscal_years.is_active IS 'Only one per company should be true';


--
-- Name: COLUMN fiscal_years.is_locked; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.fiscal_years.is_locked IS 'Prevents new transactions when true';


--
-- Name: COLUMN fiscal_years.locked_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.fiscal_years.locked_at IS 'When fiscal year was locked';


--
-- Name: COLUMN fiscal_years.locked_by_user_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.fiscal_years.locked_by_user_id IS 'User who locked the fiscal year';


--
-- Name: COLUMN fiscal_years.closing_started_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.fiscal_years.closing_started_at IS 'When closing process started';


--
-- Name: COLUMN fiscal_years.closing_completed_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.fiscal_years.closing_completed_at IS 'When closing was completed';


--
-- Name: COLUMN fiscal_years.transaction_count; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.fiscal_years.transaction_count IS 'Cached count of transactions in year';


--
-- Name: COLUMN fiscal_years.total_debits; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.fiscal_years.total_debits IS 'Sum of all debits (for validation)';


--
-- Name: COLUMN fiscal_years.total_credits; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.fiscal_years.total_credits IS 'Sum of all credits (must equal debits)';


--
-- Name: migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.migrations (
    id integer NOT NULL,
    "timestamp" bigint NOT NULL,
    name character varying NOT NULL
);


--
-- Name: migrations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.migrations_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: migrations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.migrations_id_seq OWNED BY public.migrations.id;


--
-- Name: suppliers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.suppliers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    code character varying(20) NOT NULL,
    name character varying(200) NOT NULL,
    trade_name character varying(200),
    supplier_type character varying(20) DEFAULT 'company'::character varying NOT NULL,
    tax_registration_no character varying(50),
    email character varying(200),
    phone character varying(30),
    mobile character varying(30),
    address text,
    city character varying(100),
    country character varying(100),
    postal_code character varying(20),
    payment_terms_days smallint DEFAULT 30 NOT NULL,
    currency_code character(3) DEFAULT 'USD'::bpchar NOT NULL,
    ap_account_id uuid,
    advance_account_id uuid,
    bank_name character varying(100),
    bank_account_no character varying(50),
    bank_swift_code character varying(20),
    bank_iban character varying(34),
    is_active boolean DEFAULT true NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_supplier_currency CHECK ((char_length(currency_code) = 3)),
    CONSTRAINT chk_supplier_terms CHECK (((payment_terms_days >= 0) AND (payment_terms_days <= 365))),
    CONSTRAINT chk_supplier_type CHECK (((supplier_type)::text = ANY ((ARRAY['individual'::character varying, 'company'::character varying, 'government'::character varying])::text[])))
);


--
-- Name: voucher_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.voucher_lines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    voucher_id uuid NOT NULL,
    company_id uuid NOT NULL,
    account_id uuid NOT NULL,
    account_code character varying(10) NOT NULL,
    account_name character varying(200) NOT NULL,
    dr_amount numeric(18,2) DEFAULT 0 NOT NULL,
    cr_amount numeric(18,2) DEFAULT 0 NOT NULL,
    narration text,
    line_no integer DEFAULT 1 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: vouchers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.vouchers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    voucher_number character varying(30) NOT NULL,
    voucher_type character varying(5) NOT NULL,
    voucher_date date NOT NULL,
    reference character varying(100),
    narration text,
    status character varying(20) DEFAULT 'Draft'::character varying NOT NULL,
    total_debit numeric(18,2) DEFAULT 0 NOT NULL,
    total_credit numeric(18,2) DEFAULT 0 NOT NULL,
    created_by uuid,
    posted_by uuid,
    posted_at timestamp with time zone,
    voided_by uuid,
    voided_at timestamp with time zone,
    void_reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT vouchers_voucher_type_check CHECK (((voucher_type)::text = ANY ((ARRAY['BRV'::character varying, 'BPV'::character varying, 'CRV'::character varying, 'CPV'::character varying, 'JV'::character varying, 'CV'::character varying, 'DN'::character varying, 'CN'::character varying])::text[])))
);


--
-- Name: migrations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migrations ALTER COLUMN id SET DEFAULT nextval('public.migrations_id_seq'::regclass);


--
-- Name: fiscal_years PK_0470d6bc5c757d488b7b04e1899; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fiscal_years
    ADD CONSTRAINT "PK_0470d6bc5c757d488b7b04e1899" PRIMARY KEY (id);


--
-- Name: coa_templates PK_439971bb336186e9e0fe5d214e7; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coa_templates
    ADD CONSTRAINT "PK_439971bb336186e9e0fe5d214e7" PRIMARY KEY (id);


--
-- Name: accounts PK_5a7a02c20412299d198e097a8fe; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.accounts
    ADD CONSTRAINT "PK_5a7a02c20412299d198e097a8fe" PRIMARY KEY (id);


--
-- Name: account_categories PK_7fb5719a81f2832a46953b3b7fd; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_categories
    ADD CONSTRAINT "PK_7fb5719a81f2832a46953b3b7fd" PRIMARY KEY (category_code);


--
-- Name: migrations PK_8c82d7f526340ab734260ea46be; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.migrations
    ADD CONSTRAINT "PK_8c82d7f526340ab734260ea46be" PRIMARY KEY (id);


--
-- Name: fiscal_periods PK_9bb1e4e84a0d820b943e116888d; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fiscal_periods
    ADD CONSTRAINT "PK_9bb1e4e84a0d820b943e116888d" PRIMARY KEY (id);


--
-- Name: coa_templates UQ_a4dd04262076673f83711249790; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coa_templates
    ADD CONSTRAINT "UQ_a4dd04262076673f83711249790" UNIQUE (template_code);


--
-- Name: account_audit_logs account_audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.account_audit_logs
    ADD CONSTRAINT account_audit_logs_pkey PRIMARY KEY (id);


--
-- Name: companies companies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_pkey PRIMARY KEY (id);


--
-- Name: company_groups company_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.company_groups
    ADD CONSTRAINT company_groups_pkey PRIMARY KEY (id);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: suppliers suppliers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_pkey PRIMARY KEY (id);


--
-- Name: customers uq_customer_code; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT uq_customer_code UNIQUE (company_id, code);


--
-- Name: suppliers uq_supplier_code; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT uq_supplier_code UNIQUE (company_id, code);


--
-- Name: vouchers uq_voucher_number; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vouchers
    ADD CONSTRAINT uq_voucher_number UNIQUE (company_id, voucher_number);


--
-- Name: voucher_lines voucher_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voucher_lines
    ADD CONSTRAINT voucher_lines_pkey PRIMARY KEY (id);


--
-- Name: vouchers vouchers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vouchers
    ADD CONSTRAINT vouchers_pkey PRIMARY KEY (id);


--
-- Name: idx_accounts_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accounts_code ON public.accounts USING btree (code);


--
-- Name: idx_accounts_company_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accounts_company_active ON public.accounts USING btree (company_id, is_active, is_deleted);


--
-- Name: idx_accounts_company_code; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_accounts_company_code ON public.accounts USING btree (company_id, code);


--
-- Name: idx_accounts_company_posting; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_accounts_company_posting ON public.accounts USING btree (company_id, is_posting, is_deleted);


--
-- Name: idx_audit_account_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_account_created ON public.account_audit_logs USING btree (account_id, created_at DESC);


--
-- Name: idx_audit_company_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_audit_company_created ON public.account_audit_logs USING btree (company_id, created_at DESC);


--
-- Name: idx_coa_templates_code; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_coa_templates_code ON public.coa_templates USING btree (template_code);


--
-- Name: idx_customers_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customers_active ON public.customers USING btree (company_id, is_active);


--
-- Name: idx_customers_ar_acct; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customers_ar_acct ON public.customers USING btree (ar_account_id) WHERE (ar_account_id IS NOT NULL);


--
-- Name: idx_customers_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customers_company ON public.customers USING btree (company_id);


--
-- Name: idx_customers_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customers_name ON public.customers USING btree (company_id, lower((name)::text));


--
-- Name: idx_fiscal_periods_dates; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fiscal_periods_dates ON public.fiscal_periods USING btree (start_date, end_date);


--
-- Name: idx_fiscal_periods_fy_number; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_fiscal_periods_fy_number ON public.fiscal_periods USING btree (fiscal_year_id, period_number);


--
-- Name: idx_fiscal_periods_fy_open; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fiscal_periods_fy_open ON public.fiscal_periods USING btree (fiscal_year_id, is_open, is_deleted);


--
-- Name: idx_fiscal_years_company_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fiscal_years_company_active ON public.fiscal_years USING btree (company_id, is_active, is_deleted);


--
-- Name: idx_fiscal_years_company_year; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_fiscal_years_company_year ON public.fiscal_years USING btree (company_id, fiscal_year);


--
-- Name: idx_fiscal_years_dates; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fiscal_years_dates ON public.fiscal_years USING btree (start_date, end_date);


--
-- Name: idx_suppliers_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_suppliers_active ON public.suppliers USING btree (company_id, is_active);


--
-- Name: idx_suppliers_ap_acct; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_suppliers_ap_acct ON public.suppliers USING btree (ap_account_id) WHERE (ap_account_id IS NOT NULL);


--
-- Name: idx_suppliers_company; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_suppliers_company ON public.suppliers USING btree (company_id);


--
-- Name: idx_suppliers_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_suppliers_name ON public.suppliers USING btree (company_id, lower((name)::text));


--
-- Name: idx_voucher_lines_account; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_voucher_lines_account ON public.voucher_lines USING btree (account_id);


--
-- Name: idx_voucher_lines_voucher; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_voucher_lines_voucher ON public.voucher_lines USING btree (voucher_id);


--
-- Name: idx_vouchers_company_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vouchers_company_date ON public.vouchers USING btree (company_id, voucher_date);


--
-- Name: idx_vouchers_company_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vouchers_company_status ON public.vouchers USING btree (company_id, status);


--
-- Name: customers customers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();


--
-- Name: suppliers suppliers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER suppliers_updated_at BEFORE UPDATE ON public.suppliers FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();


--
-- Name: fiscal_periods FK_af27b93d80a9090ef6b00f846f9; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fiscal_periods
    ADD CONSTRAINT "FK_af27b93d80a9090ef6b00f846f9" FOREIGN KEY (fiscal_year_id) REFERENCES public.fiscal_years(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: companies companies_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.company_groups(id) ON DELETE RESTRICT;


--
-- Name: voucher_lines voucher_lines_voucher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voucher_lines
    ADD CONSTRAINT voucher_lines_voucher_id_fkey FOREIGN KEY (voucher_id) REFERENCES public.vouchers(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--
