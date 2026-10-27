-- Proposed schema inferred from the public listing, not Milaap's internal schema.
PRAGMA foreign_keys = ON;
CREATE TABLE users (
 id INTEGER PRIMARY KEY, display_name TEXT NOT NULL,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE fundraisers (
 id INTEGER PRIMARY KEY, creator_id INTEGER NOT NULL REFERENCES users(id),
 slug TEXT NOT NULL UNIQUE, title TEXT NOT NULL, story TEXT NOT NULL,
 goal_minor INTEGER NOT NULL CHECK(goal_minor > 0),
 currency TEXT NOT NULL CHECK(length(currency) = 3),
 status TEXT NOT NULL CHECK(status IN ('draft','published','closed')),
 is_urgent INTEGER NOT NULL DEFAULT 0 CHECK(is_urgent IN (0,1)),
 tax_benefit_eligible INTEGER NOT NULL DEFAULT 0 CHECK(tax_benefit_eligible IN (0,1)),
 matching_enabled INTEGER NOT NULL DEFAULT 0 CHECK(matching_enabled IN (0,1)),
 published_at TEXT, CHECK(status <> 'published' OR published_at IS NOT NULL)
);
CREATE TABLE categories (id INTEGER PRIMARY KEY, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL);
CREATE TABLE fundraiser_categories (
 fundraiser_id INTEGER NOT NULL REFERENCES fundraisers(id),
 category_id INTEGER NOT NULL REFERENCES categories(id),
 PRIMARY KEY(fundraiser_id,category_id)
);
CREATE INDEX categories_fundraisers ON fundraiser_categories(category_id,fundraiser_id);
CREATE TABLE media (
 id INTEGER PRIMARY KEY, fundraiser_id INTEGER NOT NULL REFERENCES fundraisers(id),
 url TEXT NOT NULL, alt_text TEXT NOT NULL, position INTEGER NOT NULL DEFAULT 0,
 is_cover INTEGER NOT NULL DEFAULT 0 CHECK(is_cover IN (0,1))
);
CREATE UNIQUE INDEX one_cover ON media(fundraiser_id) WHERE is_cover=1;
CREATE TABLE donations (
 id INTEGER PRIMARY KEY, fundraiser_id INTEGER NOT NULL REFERENCES fundraisers(id),
 donor_id INTEGER REFERENCES users(id), amount_minor INTEGER NOT NULL CHECK(amount_minor>0),
 refunded_minor INTEGER NOT NULL DEFAULT 0 CHECK(refunded_minor BETWEEN 0 AND amount_minor),
 currency TEXT NOT NULL CHECK(length(currency)=3),
 status TEXT NOT NULL CHECK(status IN ('pending','captured','failed')),
 payment_reference TEXT NOT NULL UNIQUE,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- This proposal requires settlement in the campaign currency before aggregation.
CREATE TRIGGER donation_currency_insert BEFORE INSERT ON donations
WHEN NEW.currency <> (SELECT currency FROM fundraisers WHERE id=NEW.fundraiser_id)
BEGIN SELECT RAISE(ABORT,'Settle donations in the fundraiser currency'); END;
CREATE TRIGGER donation_currency_update BEFORE UPDATE OF currency,fundraiser_id ON donations
WHEN NEW.currency <> (SELECT currency FROM fundraisers WHERE id=NEW.fundraiser_id)
BEGIN SELECT RAISE(ABORT,'Settle donations in the fundraiser currency'); END;
CREATE TRIGGER fundraiser_currency_update BEFORE UPDATE OF currency ON fundraisers
WHEN EXISTS(SELECT 1 FROM donations WHERE fundraiser_id=OLD.id AND currency<>NEW.currency)
BEGIN SELECT RAISE(ABORT,'Cannot change currency after donations'); END;
CREATE INDEX listing_order ON fundraisers(status,published_at DESC,id DESC);
CREATE INDEX donation_totals ON donations(fundraiser_id,status);
CREATE VIEW fundraiser_totals AS
 SELECT f.id, f.currency, f.goal_minor,
 COALESCE(SUM(CASE WHEN d.status='captured' THEN d.amount_minor-d.refunded_minor ELSE 0 END),0) AS raised_minor
 FROM fundraisers f LEFT JOIN donations d ON d.fundraiser_id=f.id GROUP BY f.id;
-- First listing page; subsequent pages use (published_at,id) < (:cursor_time,:cursor_id).
SELECT f.id,f.slug,f.title,u.display_name,t.raised_minor,f.goal_minor,f.currency,
 100.0*t.raised_minor/f.goal_minor AS percent_funded,m.url AS cover_url
 FROM fundraisers f JOIN users u ON u.id=f.creator_id
 JOIN fundraiser_totals t ON t.id=f.id
 LEFT JOIN media m ON m.fundraiser_id=f.id AND m.is_cover=1
 WHERE f.status='published' ORDER BY f.published_at DESC,f.id DESC LIMIT 12;
