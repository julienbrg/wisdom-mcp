create table works (
  id                text primary key,
  author            text not null,
  title             text not null,
  original_title    text,
  original_language text not null,
  tradition         text not null,
  created_at        integer not null default (unixepoch())
);

create table texts (
  id           text primary key,
  work_id      text not null references works(id) on delete cascade,
  translator   text,
  year         integer,
  language     text not null,
  source_url   text,
  quotable     integer not null default 1,
  created_at   integer not null default (unixepoch())
);
create index texts_work on texts (work_id);

create table passages (
  id           text primary key,
  text_id      text not null references texts(id) on delete cascade,
  work_id      text not null references works(id) on delete cascade,
  position     integer not null,
  ref          text,
  ref_unit     text,
  raw          text not null,
  body         text not null,
  keywords     text not null default '',
  is_apparatus integer not null default 0,
  created_at   integer not null default (unixepoch())
);
create index passages_text on passages (text_id, position);
create index passages_unit on passages (work_id, ref_unit);

create table originals (
  id          integer primary key,
  work_id     text not null references works(id) on delete cascade,
  ref_unit    text not null,
  language    text not null,
  body        text not null,
  source_url  text not null,
  license     text not null,
  created_at  integer not null default (unixepoch()),
  unique (work_id, ref_unit)
);

create table translations (
  id          integer primary key,
  work_id     text not null references works(id) on delete cascade,
  ref_unit    text not null,
  language    text not null,
  translator  text not null,
  body        text not null,
  license     text not null,
  created_at  integer not null default (unixepoch()),
  unique (work_id, ref_unit, language, translator)
);

create virtual table passages_fts using fts5 (
  body,
  keywords,
  content = 'passages',
  content_rowid = 'rowid',
  tokenize = 'porter unicode61'
);

create virtual table originals_fts using fts5 (
  body,
  content = 'originals',
  content_rowid = 'id',
  tokenize = 'trigram'
);

create virtual table passages_vec using vec0 (
  passage_id text primary key,
  embedding float[1024] distance_metric=cosine
);
