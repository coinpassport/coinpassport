DROP TABLE IF EXISTS verifications;
CREATE TABLE verifications (
  id bigserial PRIMARY KEY,
  chainId int,
  feePaidBlock bigint,
  account bytea,
  vsid varchar(27),
  vsstatus varchar(20),
  vsreport varchar(27),
  redacted boolean NOT NULL DEFAULT false,
  expiration bigint,
  personal_dob date,
  personal_country varchar(4),
  countryAndDocNumberHash bytea,
  created timestamp DEFAULT now()
);
CREATE INDEX ON verifications (feePaidBlock);
CREATE INDEX ON verifications (chainId);
CREATE INDEX ON verifications (account);
GRANT ALL PRIVILEGES ON verifications TO coinpassport;
GRANT ALL PRIVILEGES ON verifications_id_seq TO coinpassport;
