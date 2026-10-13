-- One row per tool call. After 30 days the retention job moves query into query_hash (SHA-256).
create table usage (
  id               integer primary key,
  at               integer not null default (unixepoch()),
  tool             text not null,
  query            text,
  query_hash       text,
  passage_ids      text,
  hits             integer,
  duration_ms      integer not null,
  keyword_only     integer,
  embedding_tokens integer
);

create index usage_at on usage (at);
