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

--
-- Name: pgcrypto; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA public;


--
-- Name: EXTENSION pgcrypto; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pgcrypto IS 'cryptographic functions';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: InventoryItemKind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."InventoryItemKind" AS ENUM (
    'RAW_MATERIAL',
    'FINISHED_GOOD',
    'SEMI_FINISHED',
    'SERVICE',
    'CONSUMABLE',
    'PACKAGING',
    'ASSET',
    'OTHER'
);


--
-- Name: ItemPriceKind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."ItemPriceKind" AS ENUM (
    'PURCHASE',
    'SALES',
    'WHOLESALE',
    'MINIMUM_SALES'
);


--
-- Name: StockMovementKind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."StockMovementKind" AS ENUM (
    'OPENING_BALANCE',
    'PURCHASE_RECEIPT',
    'PURCHASE_RETURN',
    'SALES_DELIVERY',
    'SALES_RETURN',
    'ADJUSTMENT_IN',
    'ADJUSTMENT_OUT',
    'TRANSFER_IN',
    'TRANSFER_OUT',
    'PRODUCTION_ISSUE',
    'PRODUCTION_RECEIPT'
);


--
-- Name: StockSourceKind; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."StockSourceKind" AS ENUM (
    'OPENING_BALANCE',
    'PURCHASE_ORDER',
    'PURCHASE_INVOICE',
    'GOODS_RECEIPT',
    'SALES_ORDER',
    'SALES_INVOICE',
    'DELIVERY_NOTE',
    'SALES_RETURN',
    'PURCHASE_RETURN',
    'STOCK_ADJUSTMENT',
    'STOCK_TRANSFER',
    'PRODUCTION_ORDER',
    'MANUAL_ENTRY'
);


--
-- Name: StockTrackingMethod; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."StockTrackingMethod" AS ENUM (
    'NONE',
    'BATCH',
    'SERIAL',
    'BATCH_AND_SERIAL'
);


--
-- Name: StockValuationMethod; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public."StockValuationMethod" AS ENUM (
    'FIFO',
    'WEIGHTED_AVERAGE',
    'STANDARD_COST',
    'SPECIFIC_IDENTIFICATION'
);


--
-- Name: trg_set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trg_set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
      BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
      END;
      $$;


SET default_tablespace = '';

SET default_table_access_method = heap;

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
    CONSTRAINT "CHK_accounts_code_10digit" CHECK (((code)::text ~ '^[0-9]{10}$'::text))
);


--
-- Name: areas; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.areas (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    city_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: bank_accounts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bank_accounts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    ledger_account_id uuid NOT NULL,
    bank_name character varying(150) NOT NULL,
    branch_name character varying(150),
    account_title character varying(200) NOT NULL,
    account_number character varying(80) NOT NULL,
    iban character varying(34),
    swift_code character varying(20),
    currency_code character varying(3) DEFAULT 'PKR'::character varying NOT NULL,
    opening_balance numeric(18,2) DEFAULT 0 NOT NULL,
    opening_balance_date date,
    is_default boolean DEFAULT false NOT NULL,
    notes text,
    is_active boolean DEFAULT true NOT NULL,
    created_by_id uuid,
    updated_by_id uuid,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    code character varying(30) NOT NULL,
    branch_code character varying(50),
    account_type character varying(80),
    contact_name character varying(150),
    address text,
    post_code character varying(30),
    country character varying(100),
    city character varying(100),
    area character varying(100),
    phone_1 character varying(40),
    phone_2 character varying(40),
    mobile_number character varying(40),
    fax_number character varying(40),
    email character varying(120),
    website character varying(200)
);


--
-- Name: bank_cheque_books; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bank_cheque_books (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    bank_account_id uuid NOT NULL,
    book_number character varying(80) NOT NULL,
    prefix character varying(20),
    suffix character varying(20),
    start_cheque_number character varying(40) NOT NULL,
    end_cheque_number character varying(40) NOT NULL,
    total_cheques integer NOT NULL,
    issued_date date,
    received_date date,
    status character varying(20) DEFAULT 'Active'::character varying NOT NULL,
    notes text,
    is_active boolean DEFAULT true NOT NULL,
    created_by_id uuid,
    updated_by_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: bank_cheque_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bank_cheque_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    bank_cheque_id uuid NOT NULL,
    event_type character varying(30) NOT NULL,
    event_date timestamp with time zone DEFAULT now() NOT NULL,
    reason character varying(120),
    notes text,
    created_by_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: bank_cheques; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bank_cheques (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    bank_cheque_book_id uuid NOT NULL,
    bank_account_id uuid NOT NULL,
    serial_number integer NOT NULL,
    cheque_number character varying(80) NOT NULL,
    status character varying(20) DEFAULT 'Available'::character varying NOT NULL,
    issue_date date,
    payee_name character varying(200),
    payment_reference character varying(120),
    amount numeric(18,2),
    voided_by_id uuid,
    voided_at timestamp with time zone,
    void_reason character varying(80),
    void_notes text,
    is_active boolean DEFAULT true NOT NULL,
    created_by_id uuid,
    updated_by_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: bank_deposit_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bank_deposit_lines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    bank_deposit_id uuid NOT NULL,
    line_number integer DEFAULT 1 NOT NULL,
    received_from_account_id uuid NOT NULL,
    received_from_account_code character varying(20) NOT NULL,
    received_from_account_name character varying(200) NOT NULL,
    deposit_type_id uuid NOT NULL,
    deposit_type_name character varying(120) NOT NULL,
    description text,
    cheque_number character varying(80),
    cheque_date date,
    cheque_bank_name character varying(150),
    clearing_date date,
    amount numeric(18,2) NOT NULL,
    is_cleared boolean DEFAULT false NOT NULL,
    cleared_at timestamp(6) with time zone,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT bank_deposit_lines_amount_check CHECK ((amount > (0)::numeric))
);


--
-- Name: bank_deposit_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bank_deposit_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    code character varying(30) NOT NULL,
    name character varying(120) NOT NULL,
    deposit_kind character varying(30) DEFAULT 'OTHER'::character varying NOT NULL,
    description text,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by_id uuid,
    updated_by_id uuid,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT bank_deposit_types_deposit_kind_check CHECK (((deposit_kind)::text = ANY ((ARRAY['CASH'::character varying, 'CHEQUE'::character varying, 'BANK_TRANSFER'::character varying, 'OTHER'::character varying])::text[])))
);


--
-- Name: bank_deposits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.bank_deposits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    voucher_id uuid,
    bank_account_id uuid NOT NULL,
    deposit_number character varying(40) NOT NULL,
    deposit_date date NOT NULL,
    reference_number character varying(100),
    description text,
    status character varying(20) DEFAULT 'Draft'::character varying NOT NULL,
    cash_total numeric(18,2) DEFAULT 0 NOT NULL,
    cheque_total numeric(18,2) DEFAULT 0 NOT NULL,
    transfer_total numeric(18,2) DEFAULT 0 NOT NULL,
    other_total numeric(18,2) DEFAULT 0 NOT NULL,
    total_amount numeric(18,2) DEFAULT 0 NOT NULL,
    bank_balance_before numeric(18,2),
    bank_balance_after numeric(18,2),
    created_by_id uuid,
    updated_by_id uuid,
    posted_by_id uuid,
    posted_at timestamp(6) with time zone,
    voided_by_id uuid,
    voided_at timestamp(6) with time zone,
    void_reason text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(6) with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    CONSTRAINT bank_deposits_cash_total_check CHECK ((cash_total >= (0)::numeric)),
    CONSTRAINT bank_deposits_cheque_total_check CHECK ((cheque_total >= (0)::numeric)),
    CONSTRAINT bank_deposits_other_total_check CHECK ((other_total >= (0)::numeric)),
    CONSTRAINT bank_deposits_total_amount_check CHECK ((total_amount >= (0)::numeric)),
    CONSTRAINT bank_deposits_transfer_total_check CHECK ((transfer_total >= (0)::numeric))
);


--
-- Name: branches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.branches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    code character varying(30) NOT NULL,
    name character varying(150) NOT NULL,
    description text,
    address text,
    city character varying(100),
    phone character varying(30),
    email character varying(120),
    manager_name character varying(150),
    is_default boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: cities; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cities (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    state_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
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
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    currency_symbol character varying(10) DEFAULT 'Rs'::character varying NOT NULL,
    decimal_places integer DEFAULT 2 NOT NULL,
    thousand_separator character varying(5) DEFAULT ','::character varying NOT NULL,
    decimal_separator character varying(5) DEFAULT '.'::character varying NOT NULL,
    date_format character varying(20) DEFAULT 'dd/MM/yyyy'::character varying NOT NULL,
    time_format character varying(20) DEFAULT '12-hour'::character varying NOT NULL,
    time_zone character varying(80) DEFAULT 'Asia/Karachi'::character varying NOT NULL,
    locale character varying(20) DEFAULT 'en-PK'::character varying NOT NULL,
    default_country_code character(2) DEFAULT 'PK'::bpchar NOT NULL,
    CONSTRAINT chk_companies_decimal_places CHECK (((decimal_places >= 0) AND (decimal_places <= 6)))
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
-- Name: cost_centers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.cost_centers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    code character varying(30) NOT NULL,
    name character varying(150) NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
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
    currency_code character(3) DEFAULT 'PKR'::bpchar NOT NULL,
    ar_account_id uuid,
    advance_account_id uuid,
    is_active boolean DEFAULT true NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    party_type character varying(30) DEFAULT 'Customer'::character varying NOT NULL,
    main_role character varying(20) DEFAULT 'Customer'::character varying NOT NULL,
    CONSTRAINT chk_customer_currency CHECK ((char_length(currency_code) = 3)),
    CONSTRAINT chk_customer_limit CHECK ((credit_limit >= (0)::numeric)),
    CONSTRAINT chk_customer_terms CHECK (((payment_terms_days >= 0) AND (payment_terms_days <= 365))),
    CONSTRAINT chk_customer_type CHECK (((customer_type)::text = ANY ((ARRAY['individual'::character varying, 'company'::character varying, 'government'::character varying])::text[]))),
    CONSTRAINT chk_customers_main_role CHECK (((main_role)::text = 'Customer'::text)),
    CONSTRAINT chk_customers_party_type CHECK (((party_type)::text = ANY ((ARRAY['Customer'::character varying, 'Customer And Supplier'::character varying])::text[])))
);


--
-- Name: departments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.departments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    code character varying(30) NOT NULL,
    name character varying(150) NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: document_approvals; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_approvals (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    document_type character varying(50) NOT NULL,
    document_id uuid NOT NULL,
    approval_status character varying(30) NOT NULL,
    approved_by_id uuid,
    approved_at timestamp with time zone,
    remarks text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: document_attachments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.document_attachments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    document_type character varying(50) NOT NULL,
    document_id uuid NOT NULL,
    file_name character varying(255) NOT NULL,
    file_url character varying(500) NOT NULL,
    file_type character varying(100),
    file_size bigint,
    uploaded_by_id uuid,
    uploaded_at timestamp with time zone DEFAULT now() NOT NULL
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
    deleted_by_user_id uuid,
    closing_voucher_id uuid
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
-- Name: general_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.general_settings (
    id uuid DEFAULT public.uuid_generate_v4() NOT NULL,
    company_id uuid NOT NULL,
    default_country_code character(2) DEFAULT 'PK'::bpchar NOT NULL,
    time_zone character varying(80) DEFAULT 'Asia/Karachi'::character varying NOT NULL,
    locale character varying(20) DEFAULT 'en-PK'::character varying NOT NULL,
    date_format character varying(20) DEFAULT 'dd/MM/yyyy'::character varying NOT NULL,
    time_format character varying(20) DEFAULT '12-hour'::character varying NOT NULL,
    currency_code character(3) DEFAULT 'PKR'::bpchar NOT NULL,
    currency_symbol character varying(10) DEFAULT 'Rs'::character varying NOT NULL,
    decimal_places integer DEFAULT 2 NOT NULL,
    thousand_separator character varying(5) DEFAULT ','::character varying NOT NULL,
    decimal_separator character varying(5) DEFAULT '.'::character varying NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp with time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    currency_position character varying(10) DEFAULT 'prefix'::character varying NOT NULL,
    CONSTRAINT chk_general_settings_currency_position CHECK (((currency_position)::text = ANY ((ARRAY['prefix'::character varying, 'suffix'::character varying])::text[]))),
    CONSTRAINT chk_general_settings_decimal_places CHECK (((decimal_places >= 0) AND (decimal_places <= 6))),
    CONSTRAINT chk_general_settings_separators CHECK (((thousand_separator)::text <> (decimal_separator)::text)),
    CONSTRAINT chk_general_settings_time_format CHECK (((time_format)::text = ANY ((ARRAY['12-hour'::character varying, '24-hour'::character varying])::text[])))
);


--
-- Name: inventory_brands; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_brands (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    code character varying(30) NOT NULL,
    name character varying(120) NOT NULL,
    description text,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    notes text
);


--
-- Name: inventory_categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_categories (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    parent_id uuid,
    code character varying(30) NOT NULL,
    name character varying(150) NOT NULL,
    description text,
    level integer DEFAULT 0 NOT NULL,
    path character varying(1000) DEFAULT ''::character varying NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    notes text
);


--
-- Name: inventory_item_attributes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_item_attributes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    item_id uuid NOT NULL,
    name character varying(120) NOT NULL,
    value character varying(500) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: inventory_item_barcodes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_item_barcodes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    item_id uuid NOT NULL,
    barcode character varying(100) NOT NULL,
    label character varying(120),
    is_primary boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: inventory_item_colors; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_item_colors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    code character varying(30) NOT NULL,
    name character varying(120) NOT NULL,
    hex_code character varying(20),
    description text,
    notes text,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: inventory_item_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_item_groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    code character varying(30) NOT NULL,
    name character varying(120) NOT NULL,
    description text,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: inventory_item_images; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_item_images (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    item_id uuid NOT NULL,
    image_url text NOT NULL,
    label character varying(120),
    sort_order integer DEFAULT 0 NOT NULL,
    is_primary boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: inventory_item_prices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_item_prices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    item_id uuid NOT NULL,
    price_kind public."ItemPriceKind" NOT NULL,
    currency_code character varying(3) DEFAULT 'PKR'::character varying NOT NULL,
    price numeric(18,4) NOT NULL,
    discount_percent numeric(7,4),
    effective_from date DEFAULT CURRENT_DATE NOT NULL,
    effective_to date,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: inventory_item_sizes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_item_sizes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    code character varying(30) NOT NULL,
    name character varying(120) NOT NULL,
    description text,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    notes text
);


--
-- Name: inventory_items; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_items (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    item_code character varying(60) NOT NULL,
    sku character varying(60),
    item_name character varying(250) NOT NULL,
    sale_description text,
    detailed_description text,
    category_id uuid,
    item_group_id uuid,
    product_type_id uuid,
    brand_id uuid,
    item_size_id uuid,
    origin_id uuid,
    base_uom_id uuid,
    stock_uom_id uuid,
    purchase_uom_id uuid,
    sales_uom_id uuid,
    item_kind public."InventoryItemKind" DEFAULT 'FINISHED_GOOD'::public."InventoryItemKind" NOT NULL,
    valuation_method public."StockValuationMethod" DEFAULT 'WEIGHTED_AVERAGE'::public."StockValuationMethod" NOT NULL,
    tracking_method public."StockTrackingMethod" DEFAULT 'NONE'::public."StockTrackingMethod" NOT NULL,
    is_inventory_item boolean DEFAULT true NOT NULL,
    is_sales_item boolean DEFAULT true NOT NULL,
    is_purchase_item boolean DEFAULT true NOT NULL,
    is_manufactured_item boolean DEFAULT false NOT NULL,
    is_service_item boolean DEFAULT false NOT NULL,
    standard_cost numeric(18,4),
    default_purchase_price numeric(18,4),
    default_sales_price numeric(18,4),
    minimum_sales_price numeric(18,4),
    wholesale_price numeric(18,4),
    purchase_discount_percent numeric(7,4),
    sales_discount_percent numeric(7,4),
    wholesale_discount_percent numeric(7,4),
    import_tax_percent numeric(7,4),
    packing numeric(18,4),
    weight numeric(18,4),
    weight_uom_id uuid,
    length numeric(18,4),
    width numeric(18,4),
    height numeric(18,4),
    dimension_uom_id uuid,
    minimum_stock_level numeric(18,4),
    maximum_stock_level numeric(18,4),
    reorder_level numeric(18,4),
    reorder_quantity numeric(18,4),
    default_warehouse_id uuid,
    default_location_id uuid,
    other_information text,
    is_blocked boolean DEFAULT false NOT NULL,
    blocked_reason text,
    is_active boolean DEFAULT true NOT NULL,
    created_by_id uuid,
    updated_by_id uuid,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    notes text,
    color_id uuid
);


--
-- Name: inventory_origins; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_origins (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    code character varying(30) NOT NULL,
    name character varying(120) NOT NULL,
    description text,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    notes text
);


--
-- Name: inventory_product_types; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_product_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    code character varying(30) NOT NULL,
    name character varying(120) NOT NULL,
    description text,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    notes text
);


--
-- Name: inventory_stock_balances; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_stock_balances (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    item_id uuid NOT NULL,
    warehouse_id uuid,
    location_id uuid,
    stock_on_hand numeric(18,4) DEFAULT 0 NOT NULL,
    reserved_stock numeric(18,4) DEFAULT 0 NOT NULL,
    available_stock numeric(18,4) DEFAULT 0 NOT NULL,
    average_cost numeric(18,4) DEFAULT 0 NOT NULL,
    total_stock_value numeric(18,4) DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    branch_id uuid,
    version integer DEFAULT 1 NOT NULL,
    CONSTRAINT inventory_stock_balances_holder_check CHECK (((branch_id IS NULL) <> (warehouse_id IS NULL)))
);


--
-- Name: inventory_stock_movements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_stock_movements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    item_id uuid NOT NULL,
    warehouse_id uuid,
    location_id uuid,
    movement_date date NOT NULL,
    movement_kind public."StockMovementKind" NOT NULL,
    source_kind public."StockSourceKind" NOT NULL,
    source_document_id uuid,
    source_document_number character varying(60),
    quantity_in numeric(18,4) DEFAULT 0 NOT NULL,
    quantity_out numeric(18,4) DEFAULT 0 NOT NULL,
    unit_cost numeric(18,4),
    total_cost numeric(18,4),
    stock_after_movement numeric(18,4),
    valuation_method public."StockValuationMethod" NOT NULL,
    remarks text,
    is_active boolean DEFAULT true NOT NULL,
    created_by_id uuid,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    branch_id uuid,
    CONSTRAINT inventory_stock_movements_holder_check CHECK (((branch_id IS NULL) <> (warehouse_id IS NULL)))
);


--
-- Name: inventory_unit_conversions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_unit_conversions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    from_unit_id uuid NOT NULL,
    to_unit_id uuid NOT NULL,
    factor numeric(18,6) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: inventory_units_of_measure; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_units_of_measure (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    code character varying(30) NOT NULL,
    name character varying(120) NOT NULL,
    short_name character varying(20) NOT NULL,
    description text,
    is_default boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL
);


--
-- Name: inventory_warehouse_locations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_warehouse_locations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    warehouse_id uuid,
    code character varying(30) NOT NULL,
    name character varying(150) NOT NULL,
    description text,
    is_default boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    branch_id uuid,
    CONSTRAINT inventory_warehouse_locations_holder_check CHECK (((branch_id IS NULL) <> (warehouse_id IS NULL)))
);


--
-- Name: inventory_warehouses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.inventory_warehouses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    code character varying(30) NOT NULL,
    name character varying(150) NOT NULL,
    description text,
    address text,
    is_default boolean DEFAULT false NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    updated_at timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    branch_id uuid,
    use_locations boolean DEFAULT false NOT NULL
);


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
-- Name: projects; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.projects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    code character varying(30) NOT NULL,
    name character varying(150) NOT NULL,
    description text,
    start_date date,
    end_date date,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: purchase_invoice_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_invoice_lines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    purchase_invoice_id uuid NOT NULL,
    line_number integer NOT NULL,
    item_id uuid NOT NULL,
    item_code character varying(60) NOT NULL,
    item_name character varying(250) NOT NULL,
    uom_id uuid,
    uom_name character varying(80),
    warehouse_id uuid NOT NULL,
    quantity numeric(18,4) NOT NULL,
    purchase_price numeric(18,4) NOT NULL,
    discount_amount numeric(18,2) DEFAULT 0 NOT NULL,
    tax_amount numeric(18,2) DEFAULT 0 NOT NULL,
    line_total numeric(18,2) NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_purchase_invoice_lines_amounts CHECK (((quantity > (0)::numeric) AND (purchase_price >= (0)::numeric) AND (discount_amount >= (0)::numeric) AND (tax_amount >= (0)::numeric) AND (line_total > (0)::numeric)))
);


--
-- Name: purchase_invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_invoices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    accounting_voucher_id uuid,
    purchase_number character varying(30) NOT NULL,
    purchase_date date NOT NULL,
    supplier_id uuid NOT NULL,
    supplier_account_id uuid NOT NULL,
    supplier_invoice_number character varying(100),
    supplier_invoice_date date,
    payment_type character varying(20) NOT NULL,
    due_date date,
    warehouse_id uuid NOT NULL,
    reference_number character varying(100),
    description text,
    status character varying(20) DEFAULT 'Draft'::character varying NOT NULL,
    gross_amount numeric(18,2) DEFAULT 0 NOT NULL,
    discount_amount numeric(18,2) DEFAULT 0 NOT NULL,
    tax_amount numeric(18,2) DEFAULT 0 NOT NULL,
    freight_amount numeric(18,2) DEFAULT 0 NOT NULL,
    net_amount numeric(18,2) DEFAULT 0 NOT NULL,
    created_by_id uuid,
    updated_by_id uuid,
    posted_by_id uuid,
    posted_at timestamp with time zone,
    voided_by_id uuid,
    voided_at timestamp with time zone,
    void_reason text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    location_id uuid,
    version integer DEFAULT 1 NOT NULL,
    CONSTRAINT chk_purchase_invoices_amounts CHECK (((gross_amount >= (0)::numeric) AND (discount_amount >= (0)::numeric) AND (tax_amount >= (0)::numeric) AND (freight_amount >= (0)::numeric) AND (net_amount >= (0)::numeric))),
    CONSTRAINT chk_purchase_invoices_payment_type CHECK (((payment_type)::text = ANY ((ARRAY['Cash'::character varying, 'Credit'::character varying])::text[]))),
    CONSTRAINT chk_purchase_invoices_status CHECK (((status)::text = ANY ((ARRAY['Draft'::character varying, 'Posted'::character varying, 'Voided'::character varying])::text[])))
);


--
-- Name: purchase_return_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_return_lines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    purchase_return_id uuid NOT NULL,
    line_number integer NOT NULL,
    item_id uuid NOT NULL,
    item_code character varying(60) NOT NULL,
    item_name character varying(250) NOT NULL,
    uom_id uuid,
    uom_name character varying(80),
    warehouse_id uuid NOT NULL,
    quantity numeric(18,4) NOT NULL,
    purchase_price numeric(18,4) NOT NULL,
    discount_amount numeric(18,2) DEFAULT 0 NOT NULL,
    tax_amount numeric(18,2) DEFAULT 0 NOT NULL,
    line_total numeric(18,2) NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT chk_purchase_return_lines_amounts CHECK (((quantity > (0)::numeric) AND (purchase_price > (0)::numeric) AND (discount_amount >= (0)::numeric) AND (tax_amount >= (0)::numeric) AND (line_total > (0)::numeric)))
);


--
-- Name: purchase_returns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_returns (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    accounting_voucher_id uuid,
    purchase_return_number character varying(30) NOT NULL,
    purchase_return_date date NOT NULL,
    supplier_id uuid NOT NULL,
    supplier_account_id uuid NOT NULL,
    supplier_return_number character varying(100),
    supplier_return_date date,
    payment_type character varying(20) NOT NULL,
    warehouse_id uuid NOT NULL,
    reference_number character varying(100),
    description text,
    status character varying(20) DEFAULT 'Draft'::character varying NOT NULL,
    gross_amount numeric(18,2) DEFAULT 0 NOT NULL,
    discount_amount numeric(18,2) DEFAULT 0 NOT NULL,
    tax_amount numeric(18,2) DEFAULT 0 NOT NULL,
    freight_amount numeric(18,2) DEFAULT 0 NOT NULL,
    net_amount numeric(18,2) DEFAULT 0 NOT NULL,
    created_by_id uuid,
    updated_by_id uuid,
    posted_by_id uuid,
    posted_at timestamp with time zone,
    voided_by_id uuid,
    voided_at timestamp with time zone,
    void_reason text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    location_id uuid,
    CONSTRAINT chk_purchase_returns_amounts CHECK (((gross_amount >= (0)::numeric) AND (discount_amount >= (0)::numeric) AND (tax_amount >= (0)::numeric) AND (freight_amount >= (0)::numeric) AND (net_amount >= (0)::numeric))),
    CONSTRAINT chk_purchase_returns_payment_type CHECK (((payment_type)::text = ANY ((ARRAY['Cash'::character varying, 'Credit'::character varying])::text[]))),
    CONSTRAINT chk_purchase_returns_status CHECK (((status)::text = ANY ((ARRAY['Draft'::character varying, 'Posted'::character varying, 'Voided'::character varying])::text[])))
);


--
-- Name: purchase_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.purchase_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    default_cash_account_id uuid NOT NULL,
    default_inventory_account_id uuid NOT NULL,
    purchase_tax_account_id uuid,
    freight_account_id uuid,
    purchase_discount_account_id uuid,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: sale_invoice_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sale_invoice_lines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    sale_invoice_id uuid NOT NULL,
    line_number integer NOT NULL,
    item_id uuid NOT NULL,
    item_code character varying(60) NOT NULL,
    item_name character varying(250) NOT NULL,
    uom_id uuid,
    uom_name character varying(80),
    warehouse_id uuid,
    quantity numeric(18,4) NOT NULL,
    sale_price numeric(18,4) NOT NULL,
    discount_amount numeric(18,2) DEFAULT 0 NOT NULL,
    tax_amount numeric(18,2) DEFAULT 0 NOT NULL,
    line_total numeric(18,2) NOT NULL,
    unit_cost numeric(18,4) DEFAULT 0 NOT NULL,
    cost_amount numeric(18,2) DEFAULT 0 NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    branch_id uuid,
    CONSTRAINT chk_sale_invoice_lines_amounts CHECK (((quantity > (0)::numeric) AND (sale_price > (0)::numeric) AND (discount_amount >= (0)::numeric) AND (tax_amount >= (0)::numeric) AND (line_total > (0)::numeric) AND (unit_cost >= (0)::numeric) AND (cost_amount >= (0)::numeric))),
    CONSTRAINT sale_invoice_lines_holder_check CHECK (((branch_id IS NULL) <> (warehouse_id IS NULL)))
);


--
-- Name: sale_invoices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sale_invoices (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    accounting_voucher_id uuid,
    sale_number character varying(30) NOT NULL,
    sale_date date NOT NULL,
    customer_id uuid NOT NULL,
    customer_account_id uuid NOT NULL,
    payment_type character varying(20) NOT NULL,
    due_date date,
    warehouse_id uuid,
    customer_reference_number character varying(100),
    delivery_date date,
    delivery_note_number character varying(100),
    description text,
    status character varying(20) DEFAULT 'Draft'::character varying NOT NULL,
    gross_amount numeric(18,2) DEFAULT 0 NOT NULL,
    discount_amount numeric(18,2) DEFAULT 0 NOT NULL,
    tax_amount numeric(18,2) DEFAULT 0 NOT NULL,
    freight_amount numeric(18,2) DEFAULT 0 NOT NULL,
    net_amount numeric(18,2) DEFAULT 0 NOT NULL,
    cost_amount numeric(18,2) DEFAULT 0 NOT NULL,
    created_by_id uuid,
    updated_by_id uuid,
    posted_by_id uuid,
    posted_at timestamp with time zone,
    voided_by_id uuid,
    voided_at timestamp with time zone,
    void_reason text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    location_id uuid,
    branch_id uuid,
    version integer DEFAULT 1 NOT NULL,
    CONSTRAINT chk_sale_invoices_amounts CHECK (((gross_amount >= (0)::numeric) AND (discount_amount >= (0)::numeric) AND (tax_amount >= (0)::numeric) AND (freight_amount >= (0)::numeric) AND (net_amount >= (0)::numeric) AND (cost_amount >= (0)::numeric))),
    CONSTRAINT chk_sale_invoices_payment_type CHECK (((payment_type)::text = ANY ((ARRAY['Cash'::character varying, 'Credit'::character varying])::text[]))),
    CONSTRAINT chk_sale_invoices_status CHECK (((status)::text = ANY ((ARRAY['Draft'::character varying, 'Posted'::character varying, 'Voided'::character varying])::text[]))),
    CONSTRAINT sale_invoices_holder_check CHECK (((branch_id IS NULL) <> (warehouse_id IS NULL)))
);


--
-- Name: sale_return_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sale_return_lines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    sale_return_id uuid NOT NULL,
    line_number integer NOT NULL,
    item_id uuid NOT NULL,
    item_code character varying(60) NOT NULL,
    item_name character varying(250) NOT NULL,
    uom_id uuid,
    uom_name character varying(80),
    warehouse_id uuid,
    quantity numeric(18,4) NOT NULL,
    sale_price numeric(18,4) NOT NULL,
    discount_amount numeric(18,2) DEFAULT 0 NOT NULL,
    tax_amount numeric(18,2) DEFAULT 0 NOT NULL,
    line_total numeric(18,2) NOT NULL,
    unit_cost numeric(18,4) DEFAULT 0 NOT NULL,
    cost_amount numeric(18,2) DEFAULT 0 NOT NULL,
    description text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    branch_id uuid,
    CONSTRAINT chk_sale_return_lines_amounts CHECK (((quantity > (0)::numeric) AND (sale_price > (0)::numeric) AND (discount_amount >= (0)::numeric) AND (tax_amount >= (0)::numeric) AND (line_total > (0)::numeric) AND (unit_cost >= (0)::numeric) AND (cost_amount >= (0)::numeric))),
    CONSTRAINT sale_return_lines_holder_check CHECK (((branch_id IS NULL) <> (warehouse_id IS NULL)))
);


--
-- Name: sale_returns; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sale_returns (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    accounting_voucher_id uuid,
    sale_return_number character varying(30) NOT NULL,
    sale_return_date date NOT NULL,
    customer_id uuid NOT NULL,
    customer_account_id uuid NOT NULL,
    customer_return_number character varying(100),
    customer_return_date date,
    payment_type character varying(20) NOT NULL,
    warehouse_id uuid,
    reference_number character varying(100),
    description text,
    status character varying(20) DEFAULT 'Draft'::character varying NOT NULL,
    gross_amount numeric(18,2) DEFAULT 0 NOT NULL,
    discount_amount numeric(18,2) DEFAULT 0 NOT NULL,
    tax_amount numeric(18,2) DEFAULT 0 NOT NULL,
    freight_amount numeric(18,2) DEFAULT 0 NOT NULL,
    net_amount numeric(18,2) DEFAULT 0 NOT NULL,
    cost_amount numeric(18,2) DEFAULT 0 NOT NULL,
    created_by_id uuid,
    updated_by_id uuid,
    posted_by_id uuid,
    posted_at timestamp with time zone,
    voided_by_id uuid,
    voided_at timestamp with time zone,
    void_reason text,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    location_id uuid,
    branch_id uuid,
    CONSTRAINT chk_sale_returns_amounts CHECK (((gross_amount >= (0)::numeric) AND (discount_amount >= (0)::numeric) AND (tax_amount >= (0)::numeric) AND (freight_amount >= (0)::numeric) AND (net_amount >= (0)::numeric) AND (cost_amount >= (0)::numeric))),
    CONSTRAINT chk_sale_returns_payment_type CHECK (((payment_type)::text = ANY ((ARRAY['Cash'::character varying, 'Credit'::character varying])::text[]))),
    CONSTRAINT chk_sale_returns_status CHECK (((status)::text = ANY ((ARRAY['Draft'::character varying, 'Posted'::character varying, 'Voided'::character varying])::text[]))),
    CONSTRAINT sale_returns_holder_check CHECK (((branch_id IS NULL) <> (warehouse_id IS NULL)))
);


--
-- Name: sale_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sale_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    default_cash_account_id uuid NOT NULL,
    default_inventory_account_id uuid NOT NULL,
    sales_revenue_account_id uuid NOT NULL,
    sales_tax_account_id uuid,
    sales_discount_account_id uuid,
    freight_income_account_id uuid,
    cost_of_goods_sold_account_id uuid NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: states; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.states (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    name character varying(100) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: stock_adjustment_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_adjustment_lines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    stock_adjustment_id uuid NOT NULL,
    line_number integer NOT NULL,
    adjustment_type character varying(20) NOT NULL,
    item_id uuid NOT NULL,
    item_code character varying(60) NOT NULL,
    item_name character varying(250) NOT NULL,
    uom_name character varying(30),
    quantity numeric(18,4) NOT NULL,
    unit_cost numeric(18,4) DEFAULT 0 NOT NULL,
    total_cost numeric(18,4) DEFAULT 0 NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    CONSTRAINT stock_adjustment_lines_adjustment_type_check CHECK (((adjustment_type)::text = ANY ((ARRAY['Increase'::character varying, 'Decrease'::character varying])::text[]))),
    CONSTRAINT stock_adjustment_lines_quantity_check CHECK ((quantity > (0)::numeric)),
    CONSTRAINT stock_adjustment_lines_unit_cost_check CHECK ((unit_cost >= (0)::numeric))
);


--
-- Name: stock_adjustment_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_adjustment_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    default_inventory_account_id uuid NOT NULL,
    adjustment_gain_account_id uuid NOT NULL,
    adjustment_loss_account_id uuid NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    opening_balance_account_id uuid
);


--
-- Name: stock_adjustments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_adjustments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    adjustment_number character varying(60) NOT NULL,
    adjustment_date date NOT NULL,
    warehouse_id uuid,
    location_id uuid,
    reference_number character varying(100),
    reason character varying(150),
    description text,
    status character varying(20) DEFAULT 'Draft'::character varying NOT NULL,
    total_quantity_in numeric(18,4) DEFAULT 0 NOT NULL,
    total_quantity_out numeric(18,4) DEFAULT 0 NOT NULL,
    total_cost_in numeric(18,4) DEFAULT 0 NOT NULL,
    total_cost_out numeric(18,4) DEFAULT 0 NOT NULL,
    created_by_id uuid,
    updated_by_id uuid,
    posted_by_id uuid,
    posted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    accounting_voucher_id uuid,
    branch_id uuid,
    version integer DEFAULT 1 NOT NULL,
    voided_by_id uuid,
    voided_at timestamp(6) with time zone,
    void_reason text,
    document_kind character varying(20) DEFAULT 'Adjustment'::character varying NOT NULL,
    CONSTRAINT stock_adjustments_document_kind_check CHECK (((document_kind)::text = ANY ((ARRAY['Adjustment'::character varying, 'Opening Stock'::character varying])::text[]))),
    CONSTRAINT stock_adjustments_holder_check CHECK (((branch_id IS NULL) <> (warehouse_id IS NULL))),
    CONSTRAINT stock_adjustments_status_check CHECK (((status)::text = ANY ((ARRAY['Draft'::character varying, 'Posted'::character varying, 'Voided'::character varying])::text[])))
);


--
-- Name: stock_transfer_lines; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_transfer_lines (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    stock_transfer_id uuid NOT NULL,
    line_number integer NOT NULL,
    item_id uuid NOT NULL,
    item_code character varying(60) NOT NULL,
    item_name character varying(250) NOT NULL,
    uom_name character varying(30),
    quantity numeric(18,4) NOT NULL,
    unit_cost numeric(18,4) DEFAULT 0 NOT NULL,
    total_cost numeric(18,4) DEFAULT 0 NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    CONSTRAINT stock_transfer_lines_quantity_check CHECK ((quantity > (0)::numeric))
);


--
-- Name: stock_transfers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.stock_transfers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    transfer_number character varying(60) NOT NULL,
    transfer_date date NOT NULL,
    from_warehouse_id uuid,
    from_location_id uuid,
    to_warehouse_id uuid,
    to_location_id uuid,
    reference_number character varying(100),
    description text,
    status character varying(20) DEFAULT 'Draft'::character varying NOT NULL,
    total_quantity numeric(18,4) DEFAULT 0 NOT NULL,
    total_cost numeric(18,4) DEFAULT 0 NOT NULL,
    created_by_id uuid,
    updated_by_id uuid,
    posted_by_id uuid,
    posted_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    from_branch_id uuid,
    to_branch_id uuid,
    voided_by_id uuid,
    voided_at timestamp(6) with time zone,
    void_reason text,
    CONSTRAINT stock_transfers_from_holder_check CHECK (((from_branch_id IS NULL) <> (from_warehouse_id IS NULL))),
    CONSTRAINT stock_transfers_status_check CHECK (((status)::text = ANY ((ARRAY['Draft'::character varying, 'Posted'::character varying, 'Voided'::character varying])::text[]))),
    CONSTRAINT stock_transfers_to_holder_check CHECK (((to_branch_id IS NULL) <> (to_warehouse_id IS NULL)))
);


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
    currency_code character(3) DEFAULT 'PKR'::bpchar NOT NULL,
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
    party_type character varying(30) DEFAULT 'Supplier'::character varying NOT NULL,
    main_role character varying(20) DEFAULT 'Supplier'::character varying NOT NULL,
    CONSTRAINT chk_supplier_currency CHECK ((char_length(currency_code) = 3)),
    CONSTRAINT chk_supplier_terms CHECK (((payment_terms_days >= 0) AND (payment_terms_days <= 365))),
    CONSTRAINT chk_supplier_type CHECK (((supplier_type)::text = ANY ((ARRAY['individual'::character varying, 'company'::character varying, 'government'::character varying])::text[]))),
    CONSTRAINT chk_suppliers_main_role CHECK (((main_role)::text = 'Supplier'::text)),
    CONSTRAINT chk_suppliers_party_type CHECK (((party_type)::text = ANY ((ARRAY['Supplier'::character varying, 'Customer And Supplier'::character varying])::text[])))
);


--
-- Name: system_audit_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.system_audit_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    user_id uuid,
    user_name character varying(150) NOT NULL,
    user_email character varying(150),
    action character varying(50) NOT NULL,
    entity_name character varying(100) NOT NULL,
    entity_id character varying(100),
    description character varying(500),
    details jsonb,
    ip_address character varying(45),
    created_at timestamp(6) with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_company_access; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_company_access (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    company_id uuid NOT NULL,
    access_level character varying(20) NOT NULL,
    branch_id uuid,
    warehouse_id uuid,
    is_active boolean DEFAULT true NOT NULL,
    created_by_id uuid,
    updated_by_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_company_access_level_check CHECK (((access_level)::text = ANY ((ARRAY['ALL_BRANCHES'::character varying, 'BRANCH'::character varying, 'WAREHOUSE'::character varying])::text[]))),
    CONSTRAINT user_company_access_scope_check CHECK (((((access_level)::text = 'ALL_BRANCHES'::text) AND (branch_id IS NULL) AND (warehouse_id IS NULL)) OR (((access_level)::text = 'BRANCH'::text) AND (branch_id IS NOT NULL) AND (warehouse_id IS NULL)) OR (((access_level)::text = 'WAREHOUSE'::text) AND (warehouse_id IS NOT NULL) AND (branch_id IS NULL))))
);


--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email character varying(150) NOT NULL,
    full_name character varying(150) NOT NULL,
    password_hash text NOT NULL,
    role character varying(30) NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    last_login_at timestamp with time zone,
    password_changed_at timestamp with time zone,
    created_by_id uuid,
    updated_by_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    is_system boolean DEFAULT false NOT NULL,
    CONSTRAINT users_role_check CHECK (((role)::text = ANY ((ARRAY['admin'::character varying, 'top_management'::character varying, 'manager'::character varying, 'accountant'::character varying, 'sales_staff'::character varying, 'warehouse_staff'::character varying, 'viewer'::character varying])::text[])))
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
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    cost_center_id uuid,
    project_id uuid,
    department_id uuid
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
    approval_status character varying(30) DEFAULT 'Pending'::character varying NOT NULL,
    approved_by uuid,
    approved_at timestamp with time zone,
    auto_reverse_date date,
    reversal_status character varying(30) DEFAULT 'None'::character varying NOT NULL,
    reversal_voucher_id uuid,
    reversal_of_id uuid,
    approval_requested_by uuid,
    approval_requested_at timestamp with time zone,
    rejected_by uuid,
    rejected_at timestamp with time zone,
    rejection_reason text,
    reversed_by uuid,
    reversed_at timestamp with time zone,
    reversal_reason text,
    version integer DEFAULT 1 NOT NULL,
    CONSTRAINT vouchers_approval_status_check CHECK (((approval_status)::text = ANY ((ARRAY['Not Required'::character varying, 'Pending'::character varying, 'Approved'::character varying, 'Rejected'::character varying])::text[]))),
    CONSTRAINT vouchers_voucher_type_check CHECK (((voucher_type)::text = ANY ((ARRAY['BRV'::character varying, 'BPV'::character varying, 'CRV'::character varying, 'CPV'::character varying, 'JV'::character varying, 'CV'::character varying, 'DN'::character varying, 'CN'::character varying, 'PI'::character varying, 'PR'::character varying, 'SI'::character varying, 'SR'::character varying, 'SA'::character varying, 'RV'::character varying, 'CL'::character varying, 'OS'::character varying])::text[])))
);


--
-- Name: year_end_closing_settings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.year_end_closing_settings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    company_id uuid NOT NULL,
    retained_earnings_account_id uuid NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
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
-- Name: areas areas_city_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.areas
    ADD CONSTRAINT areas_city_id_name_key UNIQUE (city_id, name);


--
-- Name: areas areas_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.areas
    ADD CONSTRAINT areas_pkey PRIMARY KEY (id);


--
-- Name: bank_accounts bank_accounts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_accounts
    ADD CONSTRAINT bank_accounts_pkey PRIMARY KEY (id);


--
-- Name: bank_cheque_books bank_cheque_books_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_cheque_books
    ADD CONSTRAINT bank_cheque_books_pkey PRIMARY KEY (id);


--
-- Name: bank_cheque_events bank_cheque_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_cheque_events
    ADD CONSTRAINT bank_cheque_events_pkey PRIMARY KEY (id);


--
-- Name: bank_cheques bank_cheques_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_cheques
    ADD CONSTRAINT bank_cheques_pkey PRIMARY KEY (id);


--
-- Name: bank_deposit_lines bank_deposit_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_deposit_lines
    ADD CONSTRAINT bank_deposit_lines_pkey PRIMARY KEY (id);


--
-- Name: bank_deposit_types bank_deposit_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_deposit_types
    ADD CONSTRAINT bank_deposit_types_pkey PRIMARY KEY (id);


--
-- Name: bank_deposits bank_deposits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_deposits
    ADD CONSTRAINT bank_deposits_pkey PRIMARY KEY (id);


--
-- Name: branches branches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branches
    ADD CONSTRAINT branches_pkey PRIMARY KEY (id);


--
-- Name: cities cities_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cities
    ADD CONSTRAINT cities_pkey PRIMARY KEY (id);


--
-- Name: cities cities_state_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cities
    ADD CONSTRAINT cities_state_id_name_key UNIQUE (state_id, name);


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
-- Name: cost_centers cost_centers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_centers
    ADD CONSTRAINT cost_centers_pkey PRIMARY KEY (id);


--
-- Name: customers customers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT customers_pkey PRIMARY KEY (id);


--
-- Name: departments departments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT departments_pkey PRIMARY KEY (id);


--
-- Name: document_approvals document_approvals_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_approvals
    ADD CONSTRAINT document_approvals_pkey PRIMARY KEY (id);


--
-- Name: document_attachments document_attachments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.document_attachments
    ADD CONSTRAINT document_attachments_pkey PRIMARY KEY (id);


--
-- Name: general_settings general_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.general_settings
    ADD CONSTRAINT general_settings_pkey PRIMARY KEY (id);


--
-- Name: inventory_brands inventory_brands_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_brands
    ADD CONSTRAINT inventory_brands_pkey PRIMARY KEY (id);


--
-- Name: inventory_categories inventory_categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_categories
    ADD CONSTRAINT inventory_categories_pkey PRIMARY KEY (id);


--
-- Name: inventory_item_attributes inventory_item_attributes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_item_attributes
    ADD CONSTRAINT inventory_item_attributes_pkey PRIMARY KEY (id);


--
-- Name: inventory_item_barcodes inventory_item_barcodes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_item_barcodes
    ADD CONSTRAINT inventory_item_barcodes_pkey PRIMARY KEY (id);


--
-- Name: inventory_item_colors inventory_item_colors_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_item_colors
    ADD CONSTRAINT inventory_item_colors_pkey PRIMARY KEY (id);


--
-- Name: inventory_item_groups inventory_item_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_item_groups
    ADD CONSTRAINT inventory_item_groups_pkey PRIMARY KEY (id);


--
-- Name: inventory_item_images inventory_item_images_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_item_images
    ADD CONSTRAINT inventory_item_images_pkey PRIMARY KEY (id);


--
-- Name: inventory_item_prices inventory_item_prices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_item_prices
    ADD CONSTRAINT inventory_item_prices_pkey PRIMARY KEY (id);


--
-- Name: inventory_item_sizes inventory_item_sizes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_item_sizes
    ADD CONSTRAINT inventory_item_sizes_pkey PRIMARY KEY (id);


--
-- Name: inventory_items inventory_items_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_pkey PRIMARY KEY (id);


--
-- Name: inventory_origins inventory_origins_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_origins
    ADD CONSTRAINT inventory_origins_pkey PRIMARY KEY (id);


--
-- Name: inventory_product_types inventory_product_types_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_product_types
    ADD CONSTRAINT inventory_product_types_pkey PRIMARY KEY (id);


--
-- Name: inventory_stock_balances inventory_stock_balances_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_stock_balances
    ADD CONSTRAINT inventory_stock_balances_pkey PRIMARY KEY (id);


--
-- Name: inventory_stock_movements inventory_stock_movements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_stock_movements
    ADD CONSTRAINT inventory_stock_movements_pkey PRIMARY KEY (id);


--
-- Name: inventory_unit_conversions inventory_unit_conversions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_unit_conversions
    ADD CONSTRAINT inventory_unit_conversions_pkey PRIMARY KEY (id);


--
-- Name: inventory_units_of_measure inventory_units_of_measure_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_units_of_measure
    ADD CONSTRAINT inventory_units_of_measure_pkey PRIMARY KEY (id);


--
-- Name: inventory_warehouse_locations inventory_warehouse_locations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_warehouse_locations
    ADD CONSTRAINT inventory_warehouse_locations_pkey PRIMARY KEY (id);


--
-- Name: inventory_warehouses inventory_warehouses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_warehouses
    ADD CONSTRAINT inventory_warehouses_pkey PRIMARY KEY (id);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: purchase_invoice_lines purchase_invoice_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_invoice_lines
    ADD CONSTRAINT purchase_invoice_lines_pkey PRIMARY KEY (id);


--
-- Name: purchase_invoices purchase_invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_invoices
    ADD CONSTRAINT purchase_invoices_pkey PRIMARY KEY (id);


--
-- Name: purchase_return_lines purchase_return_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_return_lines
    ADD CONSTRAINT purchase_return_lines_pkey PRIMARY KEY (id);


--
-- Name: purchase_returns purchase_returns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_returns
    ADD CONSTRAINT purchase_returns_pkey PRIMARY KEY (id);


--
-- Name: purchase_settings purchase_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_settings
    ADD CONSTRAINT purchase_settings_pkey PRIMARY KEY (id);


--
-- Name: sale_invoice_lines sale_invoice_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_invoice_lines
    ADD CONSTRAINT sale_invoice_lines_pkey PRIMARY KEY (id);


--
-- Name: sale_invoices sale_invoices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_invoices
    ADD CONSTRAINT sale_invoices_pkey PRIMARY KEY (id);


--
-- Name: sale_return_lines sale_return_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_return_lines
    ADD CONSTRAINT sale_return_lines_pkey PRIMARY KEY (id);


--
-- Name: sale_returns sale_returns_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_returns
    ADD CONSTRAINT sale_returns_pkey PRIMARY KEY (id);


--
-- Name: sale_settings sale_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_settings
    ADD CONSTRAINT sale_settings_pkey PRIMARY KEY (id);


--
-- Name: states states_company_id_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.states
    ADD CONSTRAINT states_company_id_name_key UNIQUE (company_id, name);


--
-- Name: states states_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.states
    ADD CONSTRAINT states_pkey PRIMARY KEY (id);


--
-- Name: stock_adjustment_lines stock_adjustment_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_adjustment_lines
    ADD CONSTRAINT stock_adjustment_lines_pkey PRIMARY KEY (id);


--
-- Name: stock_adjustment_settings stock_adjustment_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_adjustment_settings
    ADD CONSTRAINT stock_adjustment_settings_pkey PRIMARY KEY (id);


--
-- Name: stock_adjustments stock_adjustments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_adjustments
    ADD CONSTRAINT stock_adjustments_pkey PRIMARY KEY (id);


--
-- Name: stock_transfer_lines stock_transfer_lines_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_transfer_lines
    ADD CONSTRAINT stock_transfer_lines_pkey PRIMARY KEY (id);


--
-- Name: stock_transfers stock_transfers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_transfers
    ADD CONSTRAINT stock_transfers_pkey PRIMARY KEY (id);


--
-- Name: suppliers suppliers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.suppliers
    ADD CONSTRAINT suppliers_pkey PRIMARY KEY (id);


--
-- Name: system_audit_logs system_audit_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_audit_logs
    ADD CONSTRAINT system_audit_logs_pkey PRIMARY KEY (id);


--
-- Name: cost_centers uq_cost_centers_code; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cost_centers
    ADD CONSTRAINT uq_cost_centers_code UNIQUE (company_id, code);


--
-- Name: customers uq_customer_code; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.customers
    ADD CONSTRAINT uq_customer_code UNIQUE (company_id, code);


--
-- Name: departments uq_departments_code; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.departments
    ADD CONSTRAINT uq_departments_code UNIQUE (company_id, code);


--
-- Name: general_settings uq_general_settings_company; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.general_settings
    ADD CONSTRAINT uq_general_settings_company UNIQUE (company_id);


--
-- Name: projects uq_projects_code; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.projects
    ADD CONSTRAINT uq_projects_code UNIQUE (company_id, code);


--
-- Name: purchase_invoice_lines uq_purchase_invoice_lines_number; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_invoice_lines
    ADD CONSTRAINT uq_purchase_invoice_lines_number UNIQUE (purchase_invoice_id, line_number);


--
-- Name: purchase_invoices uq_purchase_invoices_number; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_invoices
    ADD CONSTRAINT uq_purchase_invoices_number UNIQUE (company_id, purchase_number);


--
-- Name: purchase_return_lines uq_purchase_return_lines_number; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_return_lines
    ADD CONSTRAINT uq_purchase_return_lines_number UNIQUE (purchase_return_id, line_number);


--
-- Name: purchase_returns uq_purchase_returns_number; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_returns
    ADD CONSTRAINT uq_purchase_returns_number UNIQUE (company_id, purchase_return_number);


--
-- Name: purchase_settings uq_purchase_settings_company; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_settings
    ADD CONSTRAINT uq_purchase_settings_company UNIQUE (company_id);


--
-- Name: sale_invoice_lines uq_sale_invoice_lines_number; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_invoice_lines
    ADD CONSTRAINT uq_sale_invoice_lines_number UNIQUE (sale_invoice_id, line_number);


--
-- Name: sale_invoices uq_sale_invoices_number; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_invoices
    ADD CONSTRAINT uq_sale_invoices_number UNIQUE (company_id, sale_number);


--
-- Name: sale_return_lines uq_sale_return_lines_number; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_return_lines
    ADD CONSTRAINT uq_sale_return_lines_number UNIQUE (sale_return_id, line_number);


--
-- Name: sale_returns uq_sale_returns_number; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_returns
    ADD CONSTRAINT uq_sale_returns_number UNIQUE (company_id, sale_return_number);


--
-- Name: sale_settings uq_sale_settings_company; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_settings
    ADD CONSTRAINT uq_sale_settings_company UNIQUE (company_id);


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
-- Name: year_end_closing_settings uq_year_end_closing_settings_company; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.year_end_closing_settings
    ADD CONSTRAINT uq_year_end_closing_settings_company UNIQUE (company_id);


--
-- Name: user_company_access user_company_access_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_company_access
    ADD CONSTRAINT user_company_access_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


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
-- Name: year_end_closing_settings year_end_closing_settings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.year_end_closing_settings
    ADD CONSTRAINT year_end_closing_settings_pkey PRIMARY KEY (id);


--
-- Name: areas_company_id_is_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX areas_company_id_is_active_idx ON public.areas USING btree (company_id, is_active);


--
-- Name: branches_company_id_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX branches_company_id_code_key ON public.branches USING btree (company_id, code);


--
-- Name: branches_company_id_is_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX branches_company_id_is_active_idx ON public.branches USING btree (company_id, is_active);


--
-- Name: cities_company_id_is_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX cities_company_id_is_active_idx ON public.cities USING btree (company_id, is_active);


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
-- Name: idx_bank_accounts_company_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bank_accounts_company_active ON public.bank_accounts USING btree (company_id, is_active);


--
-- Name: idx_bank_accounts_company_bank_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bank_accounts_company_bank_name ON public.bank_accounts USING btree (company_id, bank_name);


--
-- Name: idx_bank_cheque_books_company_bank_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bank_cheque_books_company_bank_status ON public.bank_cheque_books USING btree (company_id, bank_account_id, status);


--
-- Name: idx_bank_cheque_events_company_cheque; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bank_cheque_events_company_cheque ON public.bank_cheque_events USING btree (company_id, bank_cheque_id, event_date DESC);


--
-- Name: idx_bank_cheques_company_bank_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bank_cheques_company_bank_status ON public.bank_cheques USING btree (company_id, bank_account_id, status);


--
-- Name: idx_bank_cheques_company_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bank_cheques_company_number ON public.bank_cheques USING btree (company_id, cheque_number);


--
-- Name: idx_bank_deposit_lines_cleared; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bank_deposit_lines_cleared ON public.bank_deposit_lines USING btree (company_id, is_cleared);


--
-- Name: idx_bank_deposit_lines_clearing_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bank_deposit_lines_clearing_date ON public.bank_deposit_lines USING btree (company_id, clearing_date);


--
-- Name: idx_bank_deposit_lines_company_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bank_deposit_lines_company_active ON public.bank_deposit_lines USING btree (company_id, is_active);


--
-- Name: idx_bank_deposit_lines_deposit; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bank_deposit_lines_deposit ON public.bank_deposit_lines USING btree (company_id, bank_deposit_id);


--
-- Name: idx_bank_deposit_lines_deposit_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bank_deposit_lines_deposit_type ON public.bank_deposit_lines USING btree (company_id, deposit_type_id);


--
-- Name: idx_bank_deposit_lines_received_from; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bank_deposit_lines_received_from ON public.bank_deposit_lines USING btree (company_id, received_from_account_id);


--
-- Name: idx_bank_deposit_types_company_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bank_deposit_types_company_active ON public.bank_deposit_types USING btree (company_id, is_active);


--
-- Name: idx_bank_deposit_types_company_kind; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bank_deposit_types_company_kind ON public.bank_deposit_types USING btree (company_id, deposit_kind);


--
-- Name: idx_bank_deposits_company_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bank_deposits_company_active ON public.bank_deposits USING btree (company_id, is_active);


--
-- Name: idx_bank_deposits_company_bank_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bank_deposits_company_bank_date ON public.bank_deposits USING btree (company_id, bank_account_id, deposit_date);


--
-- Name: idx_bank_deposits_company_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bank_deposits_company_date ON public.bank_deposits USING btree (company_id, deposit_date);


--
-- Name: idx_bank_deposits_company_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_bank_deposits_company_status ON public.bank_deposits USING btree (company_id, status);


--
-- Name: idx_coa_templates_code; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_coa_templates_code ON public.coa_templates USING btree (template_code);


--
-- Name: idx_cost_centers_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_cost_centers_active ON public.cost_centers USING btree (company_id, is_active);


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
-- Name: idx_customers_party_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_customers_party_type ON public.customers USING btree (company_id, party_type);


--
-- Name: idx_departments_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_departments_active ON public.departments USING btree (company_id, is_active);


--
-- Name: idx_document_approvals_company_document; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_approvals_company_document ON public.document_approvals USING btree (company_id, document_type, document_id);


--
-- Name: idx_document_approvals_company_status_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_approvals_company_status_created ON public.document_approvals USING btree (company_id, approval_status, created_at);


--
-- Name: idx_document_approvals_doc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_approvals_doc ON public.document_approvals USING btree (company_id, document_type, document_id);


--
-- Name: idx_document_attachments_doc; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_document_attachments_doc ON public.document_attachments USING btree (company_id, document_type, document_id);


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
-- Name: idx_general_settings_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_general_settings_active ON public.general_settings USING btree (company_id, is_active);


--
-- Name: idx_projects_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_projects_active ON public.projects USING btree (company_id, is_active);


--
-- Name: idx_purchase_invoice_lines_invoice; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_invoice_lines_invoice ON public.purchase_invoice_lines USING btree (company_id, purchase_invoice_id);


--
-- Name: idx_purchase_invoice_lines_item; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_invoice_lines_item ON public.purchase_invoice_lines USING btree (company_id, item_id);


--
-- Name: idx_purchase_invoice_lines_warehouse; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_invoice_lines_warehouse ON public.purchase_invoice_lines USING btree (company_id, warehouse_id);


--
-- Name: idx_purchase_invoices_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_invoices_active ON public.purchase_invoices USING btree (company_id, is_active);


--
-- Name: idx_purchase_invoices_company_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_invoices_company_date ON public.purchase_invoices USING btree (company_id, purchase_date);


--
-- Name: idx_purchase_invoices_company_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_invoices_company_status ON public.purchase_invoices USING btree (company_id, status);


--
-- Name: idx_purchase_invoices_doc_numbering; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_invoices_doc_numbering ON public.purchase_invoices USING btree (company_id, "substring"((purchase_number)::text, '^[A-Z]+-[0-9]+-([0-9]+)$'::text));


--
-- Name: idx_purchase_invoices_supplier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_invoices_supplier ON public.purchase_invoices USING btree (company_id, supplier_id);


--
-- Name: idx_purchase_return_lines_item; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_return_lines_item ON public.purchase_return_lines USING btree (company_id, item_id);


--
-- Name: idx_purchase_return_lines_return; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_return_lines_return ON public.purchase_return_lines USING btree (company_id, purchase_return_id);


--
-- Name: idx_purchase_returns_company_status_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_returns_company_status_date ON public.purchase_returns USING btree (company_id, status, purchase_return_date DESC, purchase_return_number DESC);


--
-- Name: idx_purchase_returns_supplier_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_returns_supplier_date ON public.purchase_returns USING btree (company_id, supplier_id, purchase_return_date DESC);


--
-- Name: idx_purchase_settings_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_purchase_settings_active ON public.purchase_settings USING btree (company_id, is_active);


--
-- Name: idx_sale_invoice_lines_invoice; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sale_invoice_lines_invoice ON public.sale_invoice_lines USING btree (company_id, sale_invoice_id);


--
-- Name: idx_sale_invoice_lines_item; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sale_invoice_lines_item ON public.sale_invoice_lines USING btree (company_id, item_id);


--
-- Name: idx_sale_invoices_company_status_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sale_invoices_company_status_date ON public.sale_invoices USING btree (company_id, status, sale_date DESC, sale_number DESC);


--
-- Name: idx_sale_invoices_customer_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sale_invoices_customer_date ON public.sale_invoices USING btree (company_id, customer_id, sale_date DESC);


--
-- Name: idx_sale_invoices_doc_numbering; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sale_invoices_doc_numbering ON public.sale_invoices USING btree (company_id, "substring"((sale_number)::text, '^[A-Z]+-[0-9]+-([0-9]+)$'::text));


--
-- Name: idx_sale_return_lines_item; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sale_return_lines_item ON public.sale_return_lines USING btree (company_id, item_id);


--
-- Name: idx_sale_return_lines_return; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sale_return_lines_return ON public.sale_return_lines USING btree (company_id, sale_return_id);


--
-- Name: idx_sale_returns_company_status_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sale_returns_company_status_date ON public.sale_returns USING btree (company_id, status, sale_return_date DESC, sale_return_number DESC);


--
-- Name: idx_sale_returns_customer_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_sale_returns_customer_date ON public.sale_returns USING btree (company_id, customer_id, sale_return_date DESC);


--
-- Name: idx_stock_adjustments_company_kind_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_adjustments_company_kind_status ON public.stock_adjustments USING btree (company_id, document_kind, status);


--
-- Name: idx_stock_adjustments_doc_numbering; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_adjustments_doc_numbering ON public.stock_adjustments USING btree (company_id, "substring"((adjustment_number)::text, '^[A-Z]+-[0-9]+-([0-9]+)$'::text));


--
-- Name: idx_stock_balances_lookup; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_balances_lookup ON public.inventory_stock_balances USING btree (company_id, item_id, warehouse_id);


--
-- Name: idx_stock_movements_comp_item_wh_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_stock_movements_comp_item_wh_date ON public.inventory_stock_movements USING btree (company_id, item_id, warehouse_id, movement_date);


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
-- Name: idx_suppliers_party_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_suppliers_party_type ON public.suppliers USING btree (company_id, party_type);


--
-- Name: idx_system_audit_logs_company_action; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_system_audit_logs_company_action ON public.system_audit_logs USING btree (company_id, action);


--
-- Name: idx_system_audit_logs_company_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_system_audit_logs_company_created ON public.system_audit_logs USING btree (company_id, created_at DESC);


--
-- Name: idx_system_audit_logs_company_entity; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_system_audit_logs_company_entity ON public.system_audit_logs USING btree (company_id, entity_name);


--
-- Name: idx_system_audit_logs_company_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_system_audit_logs_company_user ON public.system_audit_logs USING btree (company_id, user_id);


--
-- Name: idx_user_company_access_user_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_company_access_user_active ON public.user_company_access USING btree (user_id, is_active);


--
-- Name: idx_users_is_system; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_is_system ON public.users USING btree (is_system);


--
-- Name: idx_voucher_lines_account; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_voucher_lines_account ON public.voucher_lines USING btree (account_id);


--
-- Name: idx_voucher_lines_company_account_code; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_voucher_lines_company_account_code ON public.voucher_lines USING btree (company_id, account_code);


--
-- Name: idx_voucher_lines_company_account_voucher; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_voucher_lines_company_account_voucher ON public.voucher_lines USING btree (company_id, account_id, voucher_id);


--
-- Name: idx_voucher_lines_cost_center; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_voucher_lines_cost_center ON public.voucher_lines USING btree (cost_center_id) WHERE (cost_center_id IS NOT NULL);


--
-- Name: idx_voucher_lines_department; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_voucher_lines_department ON public.voucher_lines USING btree (department_id) WHERE (department_id IS NOT NULL);


--
-- Name: idx_voucher_lines_project; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_voucher_lines_project ON public.voucher_lines USING btree (project_id) WHERE (project_id IS NOT NULL);


--
-- Name: idx_voucher_lines_voucher; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_voucher_lines_voucher ON public.voucher_lines USING btree (voucher_id);


--
-- Name: idx_voucher_lines_voucher_line_no; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_voucher_lines_voucher_line_no ON public.voucher_lines USING btree (voucher_id, line_no);


--
-- Name: idx_vouchers_approval_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vouchers_approval_status ON public.vouchers USING btree (company_id, approval_status);


--
-- Name: idx_vouchers_company_approval_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vouchers_company_approval_date ON public.vouchers USING btree (company_id, approval_status, voucher_date);


--
-- Name: idx_vouchers_company_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vouchers_company_created_at ON public.vouchers USING btree (company_id, created_at);


--
-- Name: idx_vouchers_company_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vouchers_company_date ON public.vouchers USING btree (company_id, voucher_date);


--
-- Name: idx_vouchers_company_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vouchers_company_status ON public.vouchers USING btree (company_id, status);


--
-- Name: idx_vouchers_company_status_date_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vouchers_company_status_date_id ON public.vouchers USING btree (company_id, status, voucher_date, id);


--
-- Name: idx_vouchers_company_type_number; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vouchers_company_type_number ON public.vouchers USING btree (company_id, voucher_type, voucher_number);


--
-- Name: idx_vouchers_doc_numbering; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vouchers_doc_numbering ON public.vouchers USING btree (company_id, "substring"((voucher_number)::text, '^[A-Z]+-[0-9]+-([0-9]+)$'::text));


--
-- Name: idx_vouchers_reversal_of; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_vouchers_reversal_of ON public.vouchers USING btree (reversal_of_id) WHERE (reversal_of_id IS NOT NULL);


--
-- Name: inventory_brands_company_id_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX inventory_brands_company_id_code_key ON public.inventory_brands USING btree (company_id, code);


--
-- Name: inventory_brands_company_id_is_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_brands_company_id_is_active_idx ON public.inventory_brands USING btree (company_id, is_active);


--
-- Name: inventory_categories_company_id_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX inventory_categories_company_id_code_key ON public.inventory_categories USING btree (company_id, code);


--
-- Name: inventory_categories_company_id_is_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_categories_company_id_is_active_idx ON public.inventory_categories USING btree (company_id, is_active);


--
-- Name: inventory_categories_parent_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_categories_parent_id_idx ON public.inventory_categories USING btree (parent_id);


--
-- Name: inventory_item_attributes_company_id_is_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_item_attributes_company_id_is_active_idx ON public.inventory_item_attributes USING btree (company_id, is_active);


--
-- Name: inventory_item_attributes_company_id_item_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_item_attributes_company_id_item_id_idx ON public.inventory_item_attributes USING btree (company_id, item_id);


--
-- Name: inventory_item_barcodes_company_id_barcode_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX inventory_item_barcodes_company_id_barcode_key ON public.inventory_item_barcodes USING btree (company_id, barcode);


--
-- Name: inventory_item_barcodes_company_id_is_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_item_barcodes_company_id_is_active_idx ON public.inventory_item_barcodes USING btree (company_id, is_active);


--
-- Name: inventory_item_barcodes_company_id_item_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_item_barcodes_company_id_item_id_idx ON public.inventory_item_barcodes USING btree (company_id, item_id);


--
-- Name: inventory_item_colors_company_id_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX inventory_item_colors_company_id_code_key ON public.inventory_item_colors USING btree (company_id, code);


--
-- Name: inventory_item_colors_company_id_is_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_item_colors_company_id_is_active_idx ON public.inventory_item_colors USING btree (company_id, is_active);


--
-- Name: inventory_item_groups_company_id_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX inventory_item_groups_company_id_code_key ON public.inventory_item_groups USING btree (company_id, code);


--
-- Name: inventory_item_groups_company_id_is_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_item_groups_company_id_is_active_idx ON public.inventory_item_groups USING btree (company_id, is_active);


--
-- Name: inventory_item_images_company_id_is_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_item_images_company_id_is_active_idx ON public.inventory_item_images USING btree (company_id, is_active);


--
-- Name: inventory_item_images_company_id_item_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_item_images_company_id_item_id_idx ON public.inventory_item_images USING btree (company_id, item_id);


--
-- Name: inventory_item_prices_company_id_is_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_item_prices_company_id_is_active_idx ON public.inventory_item_prices USING btree (company_id, is_active);


--
-- Name: inventory_item_prices_company_id_item_id_price_kind_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_item_prices_company_id_item_id_price_kind_idx ON public.inventory_item_prices USING btree (company_id, item_id, price_kind);


--
-- Name: inventory_item_sizes_company_id_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX inventory_item_sizes_company_id_code_key ON public.inventory_item_sizes USING btree (company_id, code);


--
-- Name: inventory_item_sizes_company_id_is_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_item_sizes_company_id_is_active_idx ON public.inventory_item_sizes USING btree (company_id, is_active);


--
-- Name: inventory_items_company_id_brand_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_items_company_id_brand_id_idx ON public.inventory_items USING btree (company_id, brand_id);


--
-- Name: inventory_items_company_id_category_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_items_company_id_category_id_idx ON public.inventory_items USING btree (company_id, category_id);


--
-- Name: inventory_items_company_id_color_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_items_company_id_color_id_idx ON public.inventory_items USING btree (company_id, color_id);


--
-- Name: inventory_items_company_id_is_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_items_company_id_is_active_idx ON public.inventory_items USING btree (company_id, is_active);


--
-- Name: inventory_items_company_id_item_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX inventory_items_company_id_item_code_key ON public.inventory_items USING btree (company_id, item_code);


--
-- Name: inventory_items_company_id_sku_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX inventory_items_company_id_sku_key ON public.inventory_items USING btree (company_id, sku);


--
-- Name: inventory_origins_company_id_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX inventory_origins_company_id_code_key ON public.inventory_origins USING btree (company_id, code);


--
-- Name: inventory_origins_company_id_is_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_origins_company_id_is_active_idx ON public.inventory_origins USING btree (company_id, is_active);


--
-- Name: inventory_product_types_company_id_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX inventory_product_types_company_id_code_key ON public.inventory_product_types USING btree (company_id, code);


--
-- Name: inventory_product_types_company_id_is_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_product_types_company_id_is_active_idx ON public.inventory_product_types USING btree (company_id, is_active);


--
-- Name: inventory_stock_balances_company_id_branch_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_stock_balances_company_id_branch_id_idx ON public.inventory_stock_balances USING btree (company_id, branch_id);


--
-- Name: inventory_stock_balances_company_id_is_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_stock_balances_company_id_is_active_idx ON public.inventory_stock_balances USING btree (company_id, is_active);


--
-- Name: inventory_stock_balances_company_id_item_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_stock_balances_company_id_item_id_idx ON public.inventory_stock_balances USING btree (company_id, item_id);


--
-- Name: inventory_stock_balances_company_id_warehouse_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_stock_balances_company_id_warehouse_id_idx ON public.inventory_stock_balances USING btree (company_id, warehouse_id);


--
-- Name: inventory_stock_balances_holder_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX inventory_stock_balances_holder_key ON public.inventory_stock_balances USING btree (company_id, item_id, branch_id, warehouse_id, location_id) NULLS NOT DISTINCT;


--
-- Name: inventory_stock_movements_company_id_branch_id_movement_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_stock_movements_company_id_branch_id_movement_date ON public.inventory_stock_movements USING btree (company_id, branch_id, movement_date);


--
-- Name: inventory_stock_movements_company_id_is_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_stock_movements_company_id_is_active_idx ON public.inventory_stock_movements USING btree (company_id, is_active);


--
-- Name: inventory_stock_movements_company_id_item_id_movement_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_stock_movements_company_id_item_id_movement_date_idx ON public.inventory_stock_movements USING btree (company_id, item_id, movement_date);


--
-- Name: inventory_stock_movements_company_id_source_kind_source_documen; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_stock_movements_company_id_source_kind_source_documen ON public.inventory_stock_movements USING btree (company_id, source_kind, source_document_id);


--
-- Name: inventory_stock_movements_company_id_warehouse_id_movement_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_stock_movements_company_id_warehouse_id_movement_date ON public.inventory_stock_movements USING btree (company_id, warehouse_id, movement_date);


--
-- Name: inventory_unit_conversions_company_id_from_unit_id_to_unit_id_k; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX inventory_unit_conversions_company_id_from_unit_id_to_unit_id_k ON public.inventory_unit_conversions USING btree (company_id, from_unit_id, to_unit_id);


--
-- Name: inventory_unit_conversions_company_id_is_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_unit_conversions_company_id_is_active_idx ON public.inventory_unit_conversions USING btree (company_id, is_active);


--
-- Name: inventory_units_of_measure_company_id_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX inventory_units_of_measure_company_id_code_key ON public.inventory_units_of_measure USING btree (company_id, code);


--
-- Name: inventory_units_of_measure_company_id_is_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_units_of_measure_company_id_is_active_idx ON public.inventory_units_of_measure USING btree (company_id, is_active);


--
-- Name: inventory_units_of_measure_company_id_short_name_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX inventory_units_of_measure_company_id_short_name_key ON public.inventory_units_of_measure USING btree (company_id, short_name);


--
-- Name: inventory_warehouse_locations_branch_id_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX inventory_warehouse_locations_branch_id_code_key ON public.inventory_warehouse_locations USING btree (branch_id, code) WHERE (branch_id IS NOT NULL);


--
-- Name: inventory_warehouse_locations_company_id_is_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_warehouse_locations_company_id_is_active_idx ON public.inventory_warehouse_locations USING btree (company_id, is_active);


--
-- Name: inventory_warehouse_locations_warehouse_id_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX inventory_warehouse_locations_warehouse_id_code_key ON public.inventory_warehouse_locations USING btree (warehouse_id, code);


--
-- Name: inventory_warehouses_company_id_branch_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_warehouses_company_id_branch_id_idx ON public.inventory_warehouses USING btree (company_id, branch_id);


--
-- Name: inventory_warehouses_company_id_code_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX inventory_warehouses_company_id_code_key ON public.inventory_warehouses USING btree (company_id, code);


--
-- Name: inventory_warehouses_company_id_is_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_warehouses_company_id_is_active_idx ON public.inventory_warehouses USING btree (company_id, is_active);


--
-- Name: inventory_warehouses_company_id_use_locations_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX inventory_warehouses_company_id_use_locations_idx ON public.inventory_warehouses USING btree (company_id, use_locations);


--
-- Name: purchase_invoices_company_id_location_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX purchase_invoices_company_id_location_id_idx ON public.purchase_invoices USING btree (company_id, location_id);


--
-- Name: purchase_returns_company_id_location_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX purchase_returns_company_id_location_id_idx ON public.purchase_returns USING btree (company_id, location_id);


--
-- Name: sale_invoices_company_id_branch_id_sale_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sale_invoices_company_id_branch_id_sale_date_idx ON public.sale_invoices USING btree (company_id, branch_id, sale_date);


--
-- Name: sale_invoices_company_id_location_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sale_invoices_company_id_location_id_idx ON public.sale_invoices USING btree (company_id, location_id);


--
-- Name: sale_returns_company_id_branch_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sale_returns_company_id_branch_id_idx ON public.sale_returns USING btree (company_id, branch_id);


--
-- Name: sale_returns_company_id_location_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX sale_returns_company_id_location_id_idx ON public.sale_returns USING btree (company_id, location_id);


--
-- Name: states_company_id_is_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX states_company_id_is_active_idx ON public.states USING btree (company_id, is_active);


--
-- Name: stock_adjustment_lines_adjustment_id_line_number_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX stock_adjustment_lines_adjustment_id_line_number_key ON public.stock_adjustment_lines USING btree (stock_adjustment_id, line_number);


--
-- Name: stock_adjustment_lines_company_id_item_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stock_adjustment_lines_company_id_item_id_idx ON public.stock_adjustment_lines USING btree (company_id, item_id);


--
-- Name: stock_adjustment_settings_company_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX stock_adjustment_settings_company_id_key ON public.stock_adjustment_settings USING btree (company_id);


--
-- Name: stock_adjustments_company_id_accounting_voucher_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stock_adjustments_company_id_accounting_voucher_id_idx ON public.stock_adjustments USING btree (company_id, accounting_voucher_id);


--
-- Name: stock_adjustments_company_id_adjustment_date_adjustment_number_; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stock_adjustments_company_id_adjustment_date_adjustment_number_ ON public.stock_adjustments USING btree (company_id, adjustment_date DESC, adjustment_number DESC);


--
-- Name: stock_adjustments_company_id_adjustment_number_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX stock_adjustments_company_id_adjustment_number_key ON public.stock_adjustments USING btree (company_id, adjustment_number);


--
-- Name: stock_adjustments_company_id_branch_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stock_adjustments_company_id_branch_id_idx ON public.stock_adjustments USING btree (company_id, branch_id);


--
-- Name: stock_adjustments_company_id_status_adjustment_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stock_adjustments_company_id_status_adjustment_date_idx ON public.stock_adjustments USING btree (company_id, status, adjustment_date DESC);


--
-- Name: stock_adjustments_company_id_warehouse_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stock_adjustments_company_id_warehouse_id_idx ON public.stock_adjustments USING btree (company_id, warehouse_id);


--
-- Name: stock_transfer_lines_company_id_item_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stock_transfer_lines_company_id_item_id_idx ON public.stock_transfer_lines USING btree (company_id, item_id);


--
-- Name: stock_transfer_lines_transfer_id_line_number_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX stock_transfer_lines_transfer_id_line_number_key ON public.stock_transfer_lines USING btree (stock_transfer_id, line_number);


--
-- Name: stock_transfers_company_id_from_branch_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stock_transfers_company_id_from_branch_id_idx ON public.stock_transfers USING btree (company_id, from_branch_id);


--
-- Name: stock_transfers_company_id_from_warehouse_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stock_transfers_company_id_from_warehouse_id_idx ON public.stock_transfers USING btree (company_id, from_warehouse_id);


--
-- Name: stock_transfers_company_id_status_transfer_date_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stock_transfers_company_id_status_transfer_date_idx ON public.stock_transfers USING btree (company_id, status, transfer_date DESC);


--
-- Name: stock_transfers_company_id_to_branch_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stock_transfers_company_id_to_branch_id_idx ON public.stock_transfers USING btree (company_id, to_branch_id);


--
-- Name: stock_transfers_company_id_to_warehouse_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stock_transfers_company_id_to_warehouse_id_idx ON public.stock_transfers USING btree (company_id, to_warehouse_id);


--
-- Name: stock_transfers_company_id_transfer_date_transfer_number_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX stock_transfers_company_id_transfer_date_transfer_number_idx ON public.stock_transfers USING btree (company_id, transfer_date DESC, transfer_number DESC);


--
-- Name: stock_transfers_company_id_transfer_number_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX stock_transfers_company_id_transfer_number_key ON public.stock_transfers USING btree (company_id, transfer_number);


--
-- Name: uq_bank_accounts_account_number; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_bank_accounts_account_number ON public.bank_accounts USING btree (company_id, account_number);


--
-- Name: uq_bank_accounts_code; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_bank_accounts_code ON public.bank_accounts USING btree (company_id, code);


--
-- Name: uq_bank_accounts_ledger_account; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_bank_accounts_ledger_account ON public.bank_accounts USING btree (company_id, ledger_account_id);


--
-- Name: uq_bank_cheque_books_book_number; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_bank_cheque_books_book_number ON public.bank_cheque_books USING btree (company_id, bank_account_id, book_number);


--
-- Name: uq_bank_cheques_book_serial; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_bank_cheques_book_serial ON public.bank_cheques USING btree (company_id, bank_cheque_book_id, serial_number);


--
-- Name: uq_bank_cheques_cheque_number; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_bank_cheques_cheque_number ON public.bank_cheques USING btree (company_id, bank_account_id, cheque_number);


--
-- Name: uq_bank_deposit_lines_number; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_bank_deposit_lines_number ON public.bank_deposit_lines USING btree (bank_deposit_id, line_number);


--
-- Name: uq_bank_deposit_types_code; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_bank_deposit_types_code ON public.bank_deposit_types USING btree (company_id, code);


--
-- Name: uq_bank_deposits_number; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_bank_deposits_number ON public.bank_deposits USING btree (company_id, deposit_number);


--
-- Name: uq_bank_deposits_voucher; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_bank_deposits_voucher ON public.bank_deposits USING btree (voucher_id);


--
-- Name: uq_vouchers_reversal_of; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX uq_vouchers_reversal_of ON public.vouchers USING btree (reversal_of_id) WHERE (reversal_of_id IS NOT NULL);


--
-- Name: user_company_access_company_id_branch_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_company_access_company_id_branch_id_idx ON public.user_company_access USING btree (company_id, branch_id);


--
-- Name: user_company_access_company_id_warehouse_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX user_company_access_company_id_warehouse_id_idx ON public.user_company_access USING btree (company_id, warehouse_id);


--
-- Name: user_company_access_user_id_company_id_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX user_company_access_user_id_company_id_key ON public.user_company_access USING btree (user_id, company_id);


--
-- Name: users_email_key; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX users_email_key ON public.users USING btree (lower((email)::text));


--
-- Name: users_is_active_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX users_is_active_idx ON public.users USING btree (is_active);


--
-- Name: cost_centers cost_centers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER cost_centers_updated_at BEFORE UPDATE ON public.cost_centers FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();


--
-- Name: customers customers_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER customers_updated_at BEFORE UPDATE ON public.customers FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();


--
-- Name: departments departments_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER departments_updated_at BEFORE UPDATE ON public.departments FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();


--
-- Name: projects projects_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER projects_updated_at BEFORE UPDATE ON public.projects FOR EACH ROW EXECUTE FUNCTION public.trg_set_updated_at();


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
-- Name: areas areas_city_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.areas
    ADD CONSTRAINT areas_city_id_fkey FOREIGN KEY (city_id) REFERENCES public.cities(id) ON DELETE CASCADE;


--
-- Name: areas areas_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.areas
    ADD CONSTRAINT areas_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: bank_accounts bank_accounts_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_accounts
    ADD CONSTRAINT bank_accounts_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: bank_accounts bank_accounts_ledger_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_accounts
    ADD CONSTRAINT bank_accounts_ledger_account_id_fkey FOREIGN KEY (ledger_account_id) REFERENCES public.accounts(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: bank_cheque_books bank_cheque_books_bank_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_cheque_books
    ADD CONSTRAINT bank_cheque_books_bank_account_id_fkey FOREIGN KEY (bank_account_id) REFERENCES public.bank_accounts(id) ON DELETE RESTRICT;


--
-- Name: bank_cheque_books bank_cheque_books_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_cheque_books
    ADD CONSTRAINT bank_cheque_books_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE RESTRICT;


--
-- Name: bank_cheque_events bank_cheque_events_bank_cheque_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_cheque_events
    ADD CONSTRAINT bank_cheque_events_bank_cheque_id_fkey FOREIGN KEY (bank_cheque_id) REFERENCES public.bank_cheques(id) ON DELETE CASCADE;


--
-- Name: bank_cheque_events bank_cheque_events_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_cheque_events
    ADD CONSTRAINT bank_cheque_events_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE RESTRICT;


--
-- Name: bank_cheques bank_cheques_bank_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_cheques
    ADD CONSTRAINT bank_cheques_bank_account_id_fkey FOREIGN KEY (bank_account_id) REFERENCES public.bank_accounts(id) ON DELETE RESTRICT;


--
-- Name: bank_cheques bank_cheques_bank_cheque_book_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_cheques
    ADD CONSTRAINT bank_cheques_bank_cheque_book_id_fkey FOREIGN KEY (bank_cheque_book_id) REFERENCES public.bank_cheque_books(id) ON DELETE RESTRICT;


--
-- Name: bank_cheques bank_cheques_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_cheques
    ADD CONSTRAINT bank_cheques_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE RESTRICT;


--
-- Name: bank_deposit_lines bank_deposit_lines_bank_deposit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_deposit_lines
    ADD CONSTRAINT bank_deposit_lines_bank_deposit_id_fkey FOREIGN KEY (bank_deposit_id) REFERENCES public.bank_deposits(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: bank_deposit_lines bank_deposit_lines_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_deposit_lines
    ADD CONSTRAINT bank_deposit_lines_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: bank_deposit_lines bank_deposit_lines_deposit_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_deposit_lines
    ADD CONSTRAINT bank_deposit_lines_deposit_type_id_fkey FOREIGN KEY (deposit_type_id) REFERENCES public.bank_deposit_types(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: bank_deposit_lines bank_deposit_lines_received_from_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_deposit_lines
    ADD CONSTRAINT bank_deposit_lines_received_from_account_id_fkey FOREIGN KEY (received_from_account_id) REFERENCES public.accounts(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: bank_deposit_types bank_deposit_types_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_deposit_types
    ADD CONSTRAINT bank_deposit_types_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: bank_deposits bank_deposits_bank_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_deposits
    ADD CONSTRAINT bank_deposits_bank_account_id_fkey FOREIGN KEY (bank_account_id) REFERENCES public.bank_accounts(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: bank_deposits bank_deposits_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_deposits
    ADD CONSTRAINT bank_deposits_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: bank_deposits bank_deposits_voucher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.bank_deposits
    ADD CONSTRAINT bank_deposits_voucher_id_fkey FOREIGN KEY (voucher_id) REFERENCES public.vouchers(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: branches branches_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.branches
    ADD CONSTRAINT branches_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: cities cities_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cities
    ADD CONSTRAINT cities_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: cities cities_state_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.cities
    ADD CONSTRAINT cities_state_id_fkey FOREIGN KEY (state_id) REFERENCES public.states(id) ON DELETE CASCADE;


--
-- Name: companies companies_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.companies
    ADD CONSTRAINT companies_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.company_groups(id) ON DELETE RESTRICT;


--
-- Name: fiscal_years fiscal_years_closing_voucher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fiscal_years
    ADD CONSTRAINT fiscal_years_closing_voucher_id_fkey FOREIGN KEY (closing_voucher_id) REFERENCES public.vouchers(id) ON DELETE RESTRICT;


--
-- Name: general_settings fk_general_settings_company; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.general_settings
    ADD CONSTRAINT fk_general_settings_company FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: purchase_invoice_lines fk_purchase_invoice_lines_invoice; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_invoice_lines
    ADD CONSTRAINT fk_purchase_invoice_lines_invoice FOREIGN KEY (purchase_invoice_id) REFERENCES public.purchase_invoices(id) ON DELETE CASCADE;


--
-- Name: purchase_invoice_lines fk_purchase_invoice_lines_item; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_invoice_lines
    ADD CONSTRAINT fk_purchase_invoice_lines_item FOREIGN KEY (item_id) REFERENCES public.inventory_items(id);


--
-- Name: purchase_invoice_lines fk_purchase_invoice_lines_uom; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_invoice_lines
    ADD CONSTRAINT fk_purchase_invoice_lines_uom FOREIGN KEY (uom_id) REFERENCES public.inventory_units_of_measure(id);


--
-- Name: purchase_invoice_lines fk_purchase_invoice_lines_warehouse; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_invoice_lines
    ADD CONSTRAINT fk_purchase_invoice_lines_warehouse FOREIGN KEY (warehouse_id) REFERENCES public.inventory_warehouses(id);


--
-- Name: purchase_invoices fk_purchase_invoices_company; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_invoices
    ADD CONSTRAINT fk_purchase_invoices_company FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: purchase_invoices fk_purchase_invoices_supplier; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_invoices
    ADD CONSTRAINT fk_purchase_invoices_supplier FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id);


--
-- Name: purchase_invoices fk_purchase_invoices_supplier_account; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_invoices
    ADD CONSTRAINT fk_purchase_invoices_supplier_account FOREIGN KEY (supplier_account_id) REFERENCES public.accounts(id);


--
-- Name: purchase_invoices fk_purchase_invoices_voucher; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_invoices
    ADD CONSTRAINT fk_purchase_invoices_voucher FOREIGN KEY (accounting_voucher_id) REFERENCES public.vouchers(id);


--
-- Name: purchase_invoices fk_purchase_invoices_warehouse; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_invoices
    ADD CONSTRAINT fk_purchase_invoices_warehouse FOREIGN KEY (warehouse_id) REFERENCES public.inventory_warehouses(id);


--
-- Name: purchase_return_lines fk_purchase_return_lines_item; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_return_lines
    ADD CONSTRAINT fk_purchase_return_lines_item FOREIGN KEY (item_id) REFERENCES public.inventory_items(id);


--
-- Name: purchase_return_lines fk_purchase_return_lines_return; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_return_lines
    ADD CONSTRAINT fk_purchase_return_lines_return FOREIGN KEY (purchase_return_id) REFERENCES public.purchase_returns(id) ON DELETE CASCADE;


--
-- Name: purchase_return_lines fk_purchase_return_lines_uom; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_return_lines
    ADD CONSTRAINT fk_purchase_return_lines_uom FOREIGN KEY (uom_id) REFERENCES public.inventory_units_of_measure(id);


--
-- Name: purchase_return_lines fk_purchase_return_lines_warehouse; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_return_lines
    ADD CONSTRAINT fk_purchase_return_lines_warehouse FOREIGN KEY (warehouse_id) REFERENCES public.inventory_warehouses(id);


--
-- Name: purchase_returns fk_purchase_returns_company; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_returns
    ADD CONSTRAINT fk_purchase_returns_company FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: purchase_returns fk_purchase_returns_supplier; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_returns
    ADD CONSTRAINT fk_purchase_returns_supplier FOREIGN KEY (supplier_id) REFERENCES public.suppliers(id);


--
-- Name: purchase_returns fk_purchase_returns_supplier_account; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_returns
    ADD CONSTRAINT fk_purchase_returns_supplier_account FOREIGN KEY (supplier_account_id) REFERENCES public.accounts(id);


--
-- Name: purchase_returns fk_purchase_returns_voucher; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_returns
    ADD CONSTRAINT fk_purchase_returns_voucher FOREIGN KEY (accounting_voucher_id) REFERENCES public.vouchers(id);


--
-- Name: purchase_returns fk_purchase_returns_warehouse; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_returns
    ADD CONSTRAINT fk_purchase_returns_warehouse FOREIGN KEY (warehouse_id) REFERENCES public.inventory_warehouses(id);


--
-- Name: purchase_settings fk_purchase_settings_cash_account; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_settings
    ADD CONSTRAINT fk_purchase_settings_cash_account FOREIGN KEY (default_cash_account_id) REFERENCES public.accounts(id);


--
-- Name: purchase_settings fk_purchase_settings_company; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_settings
    ADD CONSTRAINT fk_purchase_settings_company FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: purchase_settings fk_purchase_settings_discount_account; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_settings
    ADD CONSTRAINT fk_purchase_settings_discount_account FOREIGN KEY (purchase_discount_account_id) REFERENCES public.accounts(id);


--
-- Name: purchase_settings fk_purchase_settings_freight_account; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_settings
    ADD CONSTRAINT fk_purchase_settings_freight_account FOREIGN KEY (freight_account_id) REFERENCES public.accounts(id);


--
-- Name: purchase_settings fk_purchase_settings_inventory_account; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_settings
    ADD CONSTRAINT fk_purchase_settings_inventory_account FOREIGN KEY (default_inventory_account_id) REFERENCES public.accounts(id);


--
-- Name: purchase_settings fk_purchase_settings_tax_account; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_settings
    ADD CONSTRAINT fk_purchase_settings_tax_account FOREIGN KEY (purchase_tax_account_id) REFERENCES public.accounts(id);


--
-- Name: sale_invoice_lines fk_sale_invoice_lines_invoice; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_invoice_lines
    ADD CONSTRAINT fk_sale_invoice_lines_invoice FOREIGN KEY (sale_invoice_id) REFERENCES public.sale_invoices(id) ON DELETE CASCADE;


--
-- Name: sale_invoice_lines fk_sale_invoice_lines_item; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_invoice_lines
    ADD CONSTRAINT fk_sale_invoice_lines_item FOREIGN KEY (item_id) REFERENCES public.inventory_items(id);


--
-- Name: sale_invoice_lines fk_sale_invoice_lines_uom; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_invoice_lines
    ADD CONSTRAINT fk_sale_invoice_lines_uom FOREIGN KEY (uom_id) REFERENCES public.inventory_units_of_measure(id);


--
-- Name: sale_invoice_lines fk_sale_invoice_lines_warehouse; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_invoice_lines
    ADD CONSTRAINT fk_sale_invoice_lines_warehouse FOREIGN KEY (warehouse_id) REFERENCES public.inventory_warehouses(id);


--
-- Name: sale_invoices fk_sale_invoices_company; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_invoices
    ADD CONSTRAINT fk_sale_invoices_company FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: sale_invoices fk_sale_invoices_customer; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_invoices
    ADD CONSTRAINT fk_sale_invoices_customer FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: sale_invoices fk_sale_invoices_customer_account; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_invoices
    ADD CONSTRAINT fk_sale_invoices_customer_account FOREIGN KEY (customer_account_id) REFERENCES public.accounts(id);


--
-- Name: sale_invoices fk_sale_invoices_voucher; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_invoices
    ADD CONSTRAINT fk_sale_invoices_voucher FOREIGN KEY (accounting_voucher_id) REFERENCES public.vouchers(id);


--
-- Name: sale_invoices fk_sale_invoices_warehouse; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_invoices
    ADD CONSTRAINT fk_sale_invoices_warehouse FOREIGN KEY (warehouse_id) REFERENCES public.inventory_warehouses(id);


--
-- Name: sale_return_lines fk_sale_return_lines_item; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_return_lines
    ADD CONSTRAINT fk_sale_return_lines_item FOREIGN KEY (item_id) REFERENCES public.inventory_items(id);


--
-- Name: sale_return_lines fk_sale_return_lines_return; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_return_lines
    ADD CONSTRAINT fk_sale_return_lines_return FOREIGN KEY (sale_return_id) REFERENCES public.sale_returns(id) ON DELETE CASCADE;


--
-- Name: sale_return_lines fk_sale_return_lines_uom; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_return_lines
    ADD CONSTRAINT fk_sale_return_lines_uom FOREIGN KEY (uom_id) REFERENCES public.inventory_units_of_measure(id);


--
-- Name: sale_return_lines fk_sale_return_lines_warehouse; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_return_lines
    ADD CONSTRAINT fk_sale_return_lines_warehouse FOREIGN KEY (warehouse_id) REFERENCES public.inventory_warehouses(id);


--
-- Name: sale_returns fk_sale_returns_company; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_returns
    ADD CONSTRAINT fk_sale_returns_company FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: sale_returns fk_sale_returns_customer; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_returns
    ADD CONSTRAINT fk_sale_returns_customer FOREIGN KEY (customer_id) REFERENCES public.customers(id);


--
-- Name: sale_returns fk_sale_returns_customer_account; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_returns
    ADD CONSTRAINT fk_sale_returns_customer_account FOREIGN KEY (customer_account_id) REFERENCES public.accounts(id);


--
-- Name: sale_returns fk_sale_returns_voucher; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_returns
    ADD CONSTRAINT fk_sale_returns_voucher FOREIGN KEY (accounting_voucher_id) REFERENCES public.vouchers(id);


--
-- Name: sale_returns fk_sale_returns_warehouse; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_returns
    ADD CONSTRAINT fk_sale_returns_warehouse FOREIGN KEY (warehouse_id) REFERENCES public.inventory_warehouses(id);


--
-- Name: sale_settings fk_sale_settings_cash_account; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_settings
    ADD CONSTRAINT fk_sale_settings_cash_account FOREIGN KEY (default_cash_account_id) REFERENCES public.accounts(id);


--
-- Name: sale_settings fk_sale_settings_cogs_account; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_settings
    ADD CONSTRAINT fk_sale_settings_cogs_account FOREIGN KEY (cost_of_goods_sold_account_id) REFERENCES public.accounts(id);


--
-- Name: sale_settings fk_sale_settings_company; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_settings
    ADD CONSTRAINT fk_sale_settings_company FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: sale_settings fk_sale_settings_discount_account; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_settings
    ADD CONSTRAINT fk_sale_settings_discount_account FOREIGN KEY (sales_discount_account_id) REFERENCES public.accounts(id);


--
-- Name: sale_settings fk_sale_settings_freight_account; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_settings
    ADD CONSTRAINT fk_sale_settings_freight_account FOREIGN KEY (freight_income_account_id) REFERENCES public.accounts(id);


--
-- Name: sale_settings fk_sale_settings_inventory_account; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_settings
    ADD CONSTRAINT fk_sale_settings_inventory_account FOREIGN KEY (default_inventory_account_id) REFERENCES public.accounts(id);


--
-- Name: sale_settings fk_sale_settings_revenue_account; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_settings
    ADD CONSTRAINT fk_sale_settings_revenue_account FOREIGN KEY (sales_revenue_account_id) REFERENCES public.accounts(id);


--
-- Name: sale_settings fk_sale_settings_tax_account; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_settings
    ADD CONSTRAINT fk_sale_settings_tax_account FOREIGN KEY (sales_tax_account_id) REFERENCES public.accounts(id);


--
-- Name: vouchers fk_vouchers_reversal_of; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vouchers
    ADD CONSTRAINT fk_vouchers_reversal_of FOREIGN KEY (reversal_of_id) REFERENCES public.vouchers(id) ON DELETE RESTRICT;


--
-- Name: vouchers fk_vouchers_reversal_voucher; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.vouchers
    ADD CONSTRAINT fk_vouchers_reversal_voucher FOREIGN KEY (reversal_voucher_id) REFERENCES public.vouchers(id) ON DELETE RESTRICT;


--
-- Name: inventory_brands inventory_brands_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_brands
    ADD CONSTRAINT inventory_brands_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: inventory_categories inventory_categories_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_categories
    ADD CONSTRAINT inventory_categories_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: inventory_categories inventory_categories_parent_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_categories
    ADD CONSTRAINT inventory_categories_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES public.inventory_categories(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: inventory_item_attributes inventory_item_attributes_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_item_attributes
    ADD CONSTRAINT inventory_item_attributes_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.inventory_items(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: inventory_item_barcodes inventory_item_barcodes_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_item_barcodes
    ADD CONSTRAINT inventory_item_barcodes_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.inventory_items(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: inventory_item_colors inventory_item_colors_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_item_colors
    ADD CONSTRAINT inventory_item_colors_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: inventory_item_groups inventory_item_groups_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_item_groups
    ADD CONSTRAINT inventory_item_groups_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: inventory_item_images inventory_item_images_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_item_images
    ADD CONSTRAINT inventory_item_images_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.inventory_items(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: inventory_item_prices inventory_item_prices_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_item_prices
    ADD CONSTRAINT inventory_item_prices_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.inventory_items(id) ON UPDATE CASCADE ON DELETE CASCADE;


--
-- Name: inventory_item_sizes inventory_item_sizes_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_item_sizes
    ADD CONSTRAINT inventory_item_sizes_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: inventory_items inventory_items_base_uom_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_base_uom_id_fkey FOREIGN KEY (base_uom_id) REFERENCES public.inventory_units_of_measure(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: inventory_items inventory_items_brand_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_brand_id_fkey FOREIGN KEY (brand_id) REFERENCES public.inventory_brands(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: inventory_items inventory_items_category_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.inventory_categories(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: inventory_items inventory_items_color_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_color_id_fkey FOREIGN KEY (color_id) REFERENCES public.inventory_item_colors(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: inventory_items inventory_items_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: inventory_items inventory_items_default_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_default_location_id_fkey FOREIGN KEY (default_location_id) REFERENCES public.inventory_warehouse_locations(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: inventory_items inventory_items_default_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_default_warehouse_id_fkey FOREIGN KEY (default_warehouse_id) REFERENCES public.inventory_warehouses(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: inventory_items inventory_items_dimension_uom_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_dimension_uom_id_fkey FOREIGN KEY (dimension_uom_id) REFERENCES public.inventory_units_of_measure(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: inventory_items inventory_items_item_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_item_group_id_fkey FOREIGN KEY (item_group_id) REFERENCES public.inventory_item_groups(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: inventory_items inventory_items_item_size_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_item_size_id_fkey FOREIGN KEY (item_size_id) REFERENCES public.inventory_item_sizes(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: inventory_items inventory_items_origin_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_origin_id_fkey FOREIGN KEY (origin_id) REFERENCES public.inventory_origins(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: inventory_items inventory_items_product_type_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_product_type_id_fkey FOREIGN KEY (product_type_id) REFERENCES public.inventory_product_types(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: inventory_items inventory_items_purchase_uom_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_purchase_uom_id_fkey FOREIGN KEY (purchase_uom_id) REFERENCES public.inventory_units_of_measure(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: inventory_items inventory_items_sales_uom_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_sales_uom_id_fkey FOREIGN KEY (sales_uom_id) REFERENCES public.inventory_units_of_measure(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: inventory_items inventory_items_stock_uom_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_stock_uom_id_fkey FOREIGN KEY (stock_uom_id) REFERENCES public.inventory_units_of_measure(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: inventory_items inventory_items_weight_uom_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_items
    ADD CONSTRAINT inventory_items_weight_uom_id_fkey FOREIGN KEY (weight_uom_id) REFERENCES public.inventory_units_of_measure(id) ON UPDATE CASCADE ON DELETE SET NULL;


--
-- Name: inventory_origins inventory_origins_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_origins
    ADD CONSTRAINT inventory_origins_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: inventory_product_types inventory_product_types_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_product_types
    ADD CONSTRAINT inventory_product_types_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: inventory_stock_balances inventory_stock_balances_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_stock_balances
    ADD CONSTRAINT inventory_stock_balances_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: inventory_stock_balances inventory_stock_balances_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_stock_balances
    ADD CONSTRAINT inventory_stock_balances_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: inventory_stock_balances inventory_stock_balances_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_stock_balances
    ADD CONSTRAINT inventory_stock_balances_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.inventory_items(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: inventory_stock_balances inventory_stock_balances_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_stock_balances
    ADD CONSTRAINT inventory_stock_balances_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.inventory_warehouse_locations(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: inventory_stock_balances inventory_stock_balances_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_stock_balances
    ADD CONSTRAINT inventory_stock_balances_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.inventory_warehouses(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: inventory_stock_movements inventory_stock_movements_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_stock_movements
    ADD CONSTRAINT inventory_stock_movements_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: inventory_stock_movements inventory_stock_movements_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_stock_movements
    ADD CONSTRAINT inventory_stock_movements_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: inventory_stock_movements inventory_stock_movements_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_stock_movements
    ADD CONSTRAINT inventory_stock_movements_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.inventory_items(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: inventory_stock_movements inventory_stock_movements_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_stock_movements
    ADD CONSTRAINT inventory_stock_movements_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.inventory_warehouse_locations(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: inventory_stock_movements inventory_stock_movements_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_stock_movements
    ADD CONSTRAINT inventory_stock_movements_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.inventory_warehouses(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: inventory_unit_conversions inventory_unit_conversions_from_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_unit_conversions
    ADD CONSTRAINT inventory_unit_conversions_from_unit_id_fkey FOREIGN KEY (from_unit_id) REFERENCES public.inventory_units_of_measure(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: inventory_unit_conversions inventory_unit_conversions_to_unit_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_unit_conversions
    ADD CONSTRAINT inventory_unit_conversions_to_unit_id_fkey FOREIGN KEY (to_unit_id) REFERENCES public.inventory_units_of_measure(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: inventory_units_of_measure inventory_units_of_measure_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_units_of_measure
    ADD CONSTRAINT inventory_units_of_measure_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: inventory_warehouse_locations inventory_warehouse_locations_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_warehouse_locations
    ADD CONSTRAINT inventory_warehouse_locations_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: inventory_warehouse_locations inventory_warehouse_locations_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_warehouse_locations
    ADD CONSTRAINT inventory_warehouse_locations_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: inventory_warehouse_locations inventory_warehouse_locations_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_warehouse_locations
    ADD CONSTRAINT inventory_warehouse_locations_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.inventory_warehouses(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: inventory_warehouses inventory_warehouses_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_warehouses
    ADD CONSTRAINT inventory_warehouses_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: inventory_warehouses inventory_warehouses_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.inventory_warehouses
    ADD CONSTRAINT inventory_warehouses_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON UPDATE CASCADE ON DELETE RESTRICT;


--
-- Name: purchase_invoices purchase_invoices_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_invoices
    ADD CONSTRAINT purchase_invoices_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.inventory_warehouse_locations(id);


--
-- Name: purchase_returns purchase_returns_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.purchase_returns
    ADD CONSTRAINT purchase_returns_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.inventory_warehouse_locations(id);


--
-- Name: sale_invoice_lines sale_invoice_lines_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_invoice_lines
    ADD CONSTRAINT sale_invoice_lines_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: sale_invoices sale_invoices_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_invoices
    ADD CONSTRAINT sale_invoices_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: sale_invoices sale_invoices_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_invoices
    ADD CONSTRAINT sale_invoices_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.inventory_warehouse_locations(id);


--
-- Name: sale_return_lines sale_return_lines_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_return_lines
    ADD CONSTRAINT sale_return_lines_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: sale_returns sale_returns_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_returns
    ADD CONSTRAINT sale_returns_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: sale_returns sale_returns_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.sale_returns
    ADD CONSTRAINT sale_returns_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.inventory_warehouse_locations(id);


--
-- Name: states states_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.states
    ADD CONSTRAINT states_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: stock_adjustment_lines stock_adjustment_lines_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_adjustment_lines
    ADD CONSTRAINT stock_adjustment_lines_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: stock_adjustment_lines stock_adjustment_lines_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_adjustment_lines
    ADD CONSTRAINT stock_adjustment_lines_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.inventory_items(id);


--
-- Name: stock_adjustment_lines stock_adjustment_lines_stock_adjustment_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_adjustment_lines
    ADD CONSTRAINT stock_adjustment_lines_stock_adjustment_id_fkey FOREIGN KEY (stock_adjustment_id) REFERENCES public.stock_adjustments(id) ON DELETE CASCADE;


--
-- Name: stock_adjustment_settings stock_adjustment_settings_adjustment_gain_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_adjustment_settings
    ADD CONSTRAINT stock_adjustment_settings_adjustment_gain_account_id_fkey FOREIGN KEY (adjustment_gain_account_id) REFERENCES public.accounts(id);


--
-- Name: stock_adjustment_settings stock_adjustment_settings_adjustment_loss_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_adjustment_settings
    ADD CONSTRAINT stock_adjustment_settings_adjustment_loss_account_id_fkey FOREIGN KEY (adjustment_loss_account_id) REFERENCES public.accounts(id);


--
-- Name: stock_adjustment_settings stock_adjustment_settings_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_adjustment_settings
    ADD CONSTRAINT stock_adjustment_settings_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: stock_adjustment_settings stock_adjustment_settings_default_inventory_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_adjustment_settings
    ADD CONSTRAINT stock_adjustment_settings_default_inventory_account_id_fkey FOREIGN KEY (default_inventory_account_id) REFERENCES public.accounts(id);


--
-- Name: stock_adjustments stock_adjustments_accounting_voucher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_adjustments
    ADD CONSTRAINT stock_adjustments_accounting_voucher_id_fkey FOREIGN KEY (accounting_voucher_id) REFERENCES public.vouchers(id) ON DELETE RESTRICT;


--
-- Name: stock_adjustments stock_adjustments_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_adjustments
    ADD CONSTRAINT stock_adjustments_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: stock_adjustments stock_adjustments_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_adjustments
    ADD CONSTRAINT stock_adjustments_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: stock_adjustments stock_adjustments_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_adjustments
    ADD CONSTRAINT stock_adjustments_location_id_fkey FOREIGN KEY (location_id) REFERENCES public.inventory_warehouse_locations(id);


--
-- Name: stock_adjustments stock_adjustments_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_adjustments
    ADD CONSTRAINT stock_adjustments_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.inventory_warehouses(id);


--
-- Name: stock_transfer_lines stock_transfer_lines_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_transfer_lines
    ADD CONSTRAINT stock_transfer_lines_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: stock_transfer_lines stock_transfer_lines_item_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_transfer_lines
    ADD CONSTRAINT stock_transfer_lines_item_id_fkey FOREIGN KEY (item_id) REFERENCES public.inventory_items(id);


--
-- Name: stock_transfer_lines stock_transfer_lines_stock_transfer_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_transfer_lines
    ADD CONSTRAINT stock_transfer_lines_stock_transfer_id_fkey FOREIGN KEY (stock_transfer_id) REFERENCES public.stock_transfers(id) ON DELETE CASCADE;


--
-- Name: stock_transfers stock_transfers_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_transfers
    ADD CONSTRAINT stock_transfers_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: stock_transfers stock_transfers_from_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_transfers
    ADD CONSTRAINT stock_transfers_from_branch_id_fkey FOREIGN KEY (from_branch_id) REFERENCES public.branches(id);


--
-- Name: stock_transfers stock_transfers_from_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_transfers
    ADD CONSTRAINT stock_transfers_from_location_id_fkey FOREIGN KEY (from_location_id) REFERENCES public.inventory_warehouse_locations(id);


--
-- Name: stock_transfers stock_transfers_from_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_transfers
    ADD CONSTRAINT stock_transfers_from_warehouse_id_fkey FOREIGN KEY (from_warehouse_id) REFERENCES public.inventory_warehouses(id);


--
-- Name: stock_transfers stock_transfers_to_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_transfers
    ADD CONSTRAINT stock_transfers_to_branch_id_fkey FOREIGN KEY (to_branch_id) REFERENCES public.branches(id);


--
-- Name: stock_transfers stock_transfers_to_location_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_transfers
    ADD CONSTRAINT stock_transfers_to_location_id_fkey FOREIGN KEY (to_location_id) REFERENCES public.inventory_warehouse_locations(id);


--
-- Name: stock_transfers stock_transfers_to_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.stock_transfers
    ADD CONSTRAINT stock_transfers_to_warehouse_id_fkey FOREIGN KEY (to_warehouse_id) REFERENCES public.inventory_warehouses(id);


--
-- Name: system_audit_logs system_audit_logs_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_audit_logs
    ADD CONSTRAINT system_audit_logs_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE CASCADE;


--
-- Name: system_audit_logs system_audit_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.system_audit_logs
    ADD CONSTRAINT system_audit_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: user_company_access user_company_access_branch_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_company_access
    ADD CONSTRAINT user_company_access_branch_id_fkey FOREIGN KEY (branch_id) REFERENCES public.branches(id);


--
-- Name: user_company_access user_company_access_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_company_access
    ADD CONSTRAINT user_company_access_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id);


--
-- Name: user_company_access user_company_access_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_company_access
    ADD CONSTRAINT user_company_access_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id);


--
-- Name: user_company_access user_company_access_warehouse_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_company_access
    ADD CONSTRAINT user_company_access_warehouse_id_fkey FOREIGN KEY (warehouse_id) REFERENCES public.inventory_warehouses(id);


--
-- Name: voucher_lines voucher_lines_voucher_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.voucher_lines
    ADD CONSTRAINT voucher_lines_voucher_id_fkey FOREIGN KEY (voucher_id) REFERENCES public.vouchers(id) ON DELETE CASCADE;


--
-- Name: year_end_closing_settings year_end_closing_settings_company_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.year_end_closing_settings
    ADD CONSTRAINT year_end_closing_settings_company_id_fkey FOREIGN KEY (company_id) REFERENCES public.companies(id) ON DELETE RESTRICT;


--
-- Name: year_end_closing_settings year_end_closing_settings_retained_earnings_account_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.year_end_closing_settings
    ADD CONSTRAINT year_end_closing_settings_retained_earnings_account_id_fkey FOREIGN KEY (retained_earnings_account_id) REFERENCES public.accounts(id) ON DELETE RESTRICT;


--
-- PostgreSQL database dump complete
--

