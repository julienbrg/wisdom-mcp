create table concepts (
  id         text primary key,
  name       text not null,
  original   text,
  gloss      text not null,
  summary    text not null,
  tradition  text not null,
  school     text not null,
  domains    text not null,
  created_at integer not null default (unixepoch())
);

-- Key passages point at Wisdom Context Window passages: work_slug and idx form a passage id when
-- the work is in the corpus, so the id is resolved when read and survives a re-import of the works.
create table concept_passages (
  concept_id text not null references concepts(id) on delete cascade,
  position   integer not null,
  work_slug  text not null,
  idx        integer not null,
  text       text not null,
  primary key (concept_id, position)
);

create table concept_links (
  source     text not null references concepts(id) on delete cascade,
  target     text not null references concepts(id) on delete cascade,
  type       text not null,
  note       text not null,
  primary key (source, target, type)
);
create index concept_links_target on concept_links (target);
